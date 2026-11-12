import type { Kysely, Selectable, Transaction } from "kysely";
import { randomUUID } from "../bytes";
import type { Database, ItemExchange, ProposalItemState, ProposalItemTable, ProposalTable } from "../db/schema";
import { publicPath } from "../entries/paths";
import { CheckError, ConflictError, ForbiddenError, isMontiError } from "../errors";
import { type AnyOperation, type Message, type Preview, type RecordRef, recordKey } from "../operation";
import { context, type Engine, loadRecords, parseInput, type RunOptions, type WriteResult } from "./execute";
import { undo } from "./undo";

type Db = Kysely<Database> | Transaction<Database>;
type Item = Selectable<ProposalItemTable>;

/**
 * In an item's input, the id a former item of the same proposal creates: `{ "$item": "<item id>" }` stands for that item's `output.id`. Applying
 * puts the real id in; when the former item is left out or fails, the item that points at it is skipped.
 */
export type ItemRef = { $item: string };

const isItemRef = (value: unknown): value is ItemRef =>
	typeof value === "object" &&
	value !== null &&
	Object.keys(value).length === 1 &&
	typeof (value as ItemRef).$item === "string";

/** Replaces every item reference in `value` with `resolve(itemId)`. */
function mapRefs(value: unknown, resolve: (itemId: string) => unknown): unknown {
	if (isItemRef(value)) return resolve(value.$item);
	if (Array.isArray(value)) return value.map((element) => mapRefs(element, resolve));
	if (typeof value === "object" && value !== null)
		return Object.fromEntries(Object.entries(value).map(([key, element]) => [key, mapRefs(element, resolve)]));
	return value;
}

function refsIn(value: unknown, found = new Set<string>()): Set<string> {
	mapRefs(value, (itemId) => found.add(itemId));
	return found;
}

/** Stands in for an id that does not exist yet, so the input still passes its schema. */
const placeholder = (itemId: string) => `$item:${itemId}`;
const withPlaceholders = (rawInput: unknown) => mapRefs(rawInput, (itemId) => placeholder(itemId));

class Rollback extends Error {}

/** How long an apply holds its proposal between two items; an apply that died lets go after this. */
const APPLY_LEASE_MS = 60_000;

export async function createProposal(
	engine: Engine,
	conversationId: string,
	request: string,
	runId: string | null = null,
): Promise<string> {
	const id = randomUUID();
	await engine.db
		.insertInto("monti_proposal")
		.values({
			id,
			conversation_id: conversationId,
			run_id: runId,
			request,
			status: "pending",
			created_at: engine.now(),
		})
		.execute();
	return id;
}

/** What the assistant may never propose: what only a person runs, signing in, and structure on the live site. */
function mustBeProposable(engine: Engine, operation: AnyOperation) {
	// Before the input is read at all: a proposal keeps its input as it came, and what only a person may run (a key to add, a password) must not be
	// kept anywhere.
	if (operation.humanOnly || operation.open)
		throw new ForbiddenError({ key: "errors.humanOnly", values: { operation: operation.name } });
	if (operation.structure && engine.site.files === null)
		throw new ForbiddenError({ key: "errors.structureLocked", values: { operation: operation.name } });
}

/**
 * What a write would do, without doing it: its `check` and `preview` run in a transaction that is rolled back, and the versions of the records it
 * touches are read, so applying it later can tell whether they changed in the meantime.
 */
async function rehearse(engine: Engine, operation: AnyOperation, input: unknown, checks: boolean) {
	let baseVersions: Record<string, number> = {};
	let preview: Preview | null = null;
	// As a write does: before the transaction, so nothing is held while another service answers.
	const prepared = checks ? await operation.prepare?.(input, context(engine, engine.db, "assistant").ctx) : undefined;
	await engine.db
		.transaction()
		.execute(async (trx) => {
			const { ctx } = context(engine, trx, "assistant");
			const touched = (await operation.touches?.(input, ctx)) ?? [];
			const states = await loadRecords(engine, trx, touched);
			baseVersions = Object.fromEntries(
				[...states].flatMap(([key, state]) => (state === null ? [] : [[key, state.version]])),
			);
			// An input that points at a former item names records that do not exist yet, so its checks wait for the apply.
			if (checks) await operation.check?.(input, ctx, prepared);
			preview = (await operation.preview?.(input, ctx)) ?? null;
			throw new Rollback();
		})
		.catch((error) => {
			if (!(error instanceof Rollback)) throw error;
		});
	return { baseVersions, preview: preview as Preview | null };
}

/** The inputs one proposed write becomes: itself, or one per element of its `each` list when it names several. */
function split(operation: AnyOperation, rawInput: unknown): unknown[] {
	const list = operation.each ? (rawInput as Record<string, unknown> | null)?.[operation.each] : undefined;
	if (!operation.each || !Array.isArray(list) || list.length < 2) return [rawInput];
	return list.map((element) => ({ ...(rawInput as object), [operation.each as string]: [element] }));
}

/** Refuses a write that changes a place another waiting item of the proposal already changes (`overlaps`). */
function mustNotOverlap(operation: AnyOperation, input: unknown, waiting: Item[], except?: string) {
	if (!operation.overlaps) return;
	for (const item of waiting) {
		if (item.id === except || item.state !== "pending" || item.operation !== operation.name) continue;
		if (operation.overlaps(input, parseInput(operation, withPlaceholders(item.input))))
			throw new CheckError({ key: "proposals.samePlace" });
	}
}

const itemsOf = (db: Db, proposalId: string) =>
	db.selectFrom("monti_proposal_item").selectAll().where("proposal_id", "=", proposalId).orderBy("position").execute();

/**
 * Adds a write the assistant asked for to a proposal. Nothing changes: the write is rehearsed and rolled back. A write that names several records
 * through its `each` list becomes one item per record, so a person takes or leaves each. `group` is the name the assistant gave this kind of change.
 */
export async function proposeItem(
	engine: Engine,
	proposalId: string,
	operation: AnyOperation,
	rawInput: unknown,
	options: { group?: string } = {},
): Promise<{ itemId: string; itemIds: string[]; preview: Preview | null }> {
	mustBeProposable(engine, operation);
	const refs = refsIn(rawInput);
	const known = await itemsOf(engine.db, proposalId);
	for (const ref of refs)
		if (!known.some((item) => item.id === ref)) throw new Error(`Item ${ref} is not an earlier item of this proposal.`);
	const input = parseInput(operation, withPlaceholders(rawInput));
	mustNotOverlap(operation, input, known);

	// The whole write is rehearsed once: its checks answer for all of it, and its preview says what all of it would do.
	const whole = await rehearse(engine, operation, input, refs.size === 0);
	const parts = split(operation, rawInput);
	const rows = [];
	for (const [index, part] of parts.entries()) {
		// Each record's own item keeps the versions of what that one write touches.
		const baseVersions =
			parts.length === 1
				? whole.baseVersions
				: (await rehearse(engine, operation, parseInput(operation, withPlaceholders(part)), false)).baseVersions;
		rows.push({
			id: randomUUID(),
			proposal_id: proposalId,
			position: known.length + index,
			operation: operation.name,
			input: JSON.stringify(part),
			base_versions: JSON.stringify(baseVersions),
			state: "pending" as const,
			reason: null,
			output: null,
			activity_id: null,
			group_label: options.group ?? "",
		});
	}
	await engine.db.insertInto("monti_proposal_item").values(rows).execute();
	await settleProposal(engine.db, proposalId);
	return { itemId: rows[0].id, itemIds: rows.map((row) => row.id), preview: whole.preview };
}

/**
 * Puts a new write in an item's place (doc 10): the item made again after its record changed, or changed by a request at its own place. The item
 * keeps its id, its place in the proposal and what was asked of it; it waits again, kept in.
 */
export async function replaceItem(
	engine: Engine,
	itemId: string,
	operation: AnyOperation,
	rawInput: unknown,
): Promise<{ itemId: string; preview: Preview | null }> {
	mustBeProposable(engine, operation);
	const item = await engine.db
		.selectFrom("monti_proposal_item")
		.selectAll()
		.where("id", "=", itemId)
		.executeTakeFirst();
	if (!item || !["pending", "stale", "failed"].includes(item.state))
		throw new CheckError({ key: "proposals.notWaiting" });
	if (split(operation, rawInput).length > 1) throw new CheckError({ key: "proposals.oneRecord" });
	const input = parseInput(operation, withPlaceholders(rawInput));
	mustNotOverlap(operation, input, await itemsOf(engine.db, item.proposal_id), itemId);
	const { baseVersions, preview } = await rehearse(engine, operation, input, refsIn(rawInput).size === 0);
	const replaced = await engine.db
		.updateTable("monti_proposal_item")
		.set({
			operation: operation.name,
			input: JSON.stringify(rawInput),
			base_versions: JSON.stringify(baseVersions),
			state: "pending",
			reason: null,
			included: true,
		})
		.where("id", "=", itemId)
		.where("state", "in", ["pending", "stale", "failed"])
		.returning("id")
		.executeTakeFirst();
	if (!replaced) throw new CheckError({ key: "proposals.notWaiting" });
	await settleProposal(engine.db, item.proposal_id);
	return { itemId, preview };
}

/** Adds one exchange to an item's own thread (what the person asked at its place, and the answer). */
export async function addExchange(db: Db, itemId: string, exchange: ItemExchange): Promise<void> {
	const item = await db.selectFrom("monti_proposal_item").select("thread").where("id", "=", itemId).executeTakeFirst();
	if (!item) return;
	await db
		.updateTable("monti_proposal_item")
		.set({ thread: JSON.stringify([...item.thread, exchange]) })
		.where("id", "=", itemId)
		.execute();
}

export type ApplyResult = { itemId: string; state: ProposalItemState; reason?: Message }[];

/** One step of an apply, for whoever watches it (the review's "9 / 17"). */
export type ApplyProgress = { done: number; total: number; itemId: string; state: ProposalItemState; reason?: Message };

/**
 * How far this proposal's own writes have moved each record on: the version the first of them found (the reading the items were made on) and the
 * version the last of them left. A later item made on the same reading follows from there instead of being "changed in the meantime".
 */
function movedBy(items: Item[]) {
	const moved = new Map<string, { from: number; to: number }>();
	for (const item of items) {
		if (item.state !== "applied" || !item.after_versions) continue;
		note(moved, item.base_versions, item.after_versions);
	}
	return moved;
}

function note(
	moved: Map<string, { from: number; to: number }>,
	base: Record<string, number>,
	after: Record<string, number | null>,
) {
	for (const [key, to] of Object.entries(after)) {
		const from = moved.get(key)?.from ?? base[key];
		if (to === null || from === undefined) moved.delete(key);
		else moved.set(key, { from, to });
	}
}

/**
 * The versions and input an item is applied with. Where an earlier item of the same proposal moved a record on from the reading this one was made
 * on, a write that can follow (`follows`) is brought to the version the earlier one left; one that cannot keeps its own, and will be found changed.
 */
function following(
	operation: AnyOperation,
	item: Item,
	input: unknown,
	moved: Map<string, { from: number; to: number }>,
): { versions: Record<string, number>; input: unknown } {
	const ahead = Object.entries(item.base_versions).filter(([key, base]) => {
		const step = moved.get(key);
		return step !== undefined && step.from === base && step.to !== base;
	});
	if (ahead.length === 0 || !operation.follows) return { versions: item.base_versions, input };
	const versions = {
		...item.base_versions,
		...Object.fromEntries(ahead.map(([key]) => [key, moved.get(key)?.to as number])),
	};
	const followed = operation.follows(input, versions);
	return followed === null ? { versions: item.base_versions, input } : { versions, input: followed };
}

/**
 * Applies a proposal's waiting items the person kept, in order, each as its own write on the same path a person's write takes. Items left out are
 * dropped. There is no transaction around the whole: an item that fails or changed in the meantime is recorded with its reason and the rest go
 * on, and each result is stored at once, so an apply cut short goes on with what is left when it is run again. `include`, when given, says which
 * items are kept instead of the stored checks.
 */
export async function applyProposal(
	engine: Engine,
	operations: ReadonlyMap<string, AnyOperation>,
	proposalId: string,
	include: string[] | undefined,
	write: <Output>(operation: AnyOperation, input: unknown, options: RunOptions) => Promise<WriteResult<Output>>,
	onProgress?: (progress: ApplyProgress) => void | Promise<void>,
): Promise<ApplyResult> {
	const lease = () => new Date(engine.now().getTime() + APPLY_LEASE_MS);
	const proposal = await engine.db
		.updateTable("monti_proposal")
		.set({ applying_until: lease() })
		.where("id", "=", proposalId)
		.where((eb) => eb.or([eb("applying_until", "is", null), eb("applying_until", "<", engine.now())]))
		.returning("conversation_id")
		.executeTakeFirst();
	if (!proposal) {
		const there = await engine.db
			.selectFrom("monti_proposal")
			.select("id")
			.where("id", "=", proposalId)
			.executeTakeFirst();
		throw new CheckError({ key: there ? "proposals.applying" : "proposals.unknown" });
	}
	const results: ApplyResult = [];
	try {
		await settleWritten(engine.db, proposalId, results);
		const items = await itemsOf(engine.db, proposalId);
		const outputs = new Map(items.filter((item) => item.state === "applied").map((item) => [item.id, item.output]));
		const moved = movedBy(items);
		const kept = (item: Item) => (include ? include.includes(item.id) : item.included);
		const total = items.filter((item) => item.state === "pending" && kept(item)).length;
		let done = 0;

		const settle = async (
			item: Item,
			state: ProposalItemState,
			extra: {
				reason?: Message;
				output?: unknown;
				activityId?: string | null;
				after?: Record<string, number | null>;
			} = {},
		) => {
			await engine.db
				.updateTable("monti_proposal_item")
				.set({
					state,
					reason: extra.reason ? JSON.stringify(extra.reason) : null,
					output: extra.output === undefined ? null : JSON.stringify(extra.output),
					activity_id: extra.activityId ?? null,
					after_versions: extra.after ? JSON.stringify(extra.after) : null,
				})
				.where("id", "=", item.id)
				.execute();
			results.push({ itemId: item.id, state, ...(extra.reason ? { reason: extra.reason } : {}) });
			if (state === "discarded") return;
			done += 1;
			await engine.db
				.updateTable("monti_proposal")
				.set({ applying_until: lease() })
				.where("id", "=", proposalId)
				.execute();
			await onProgress?.({ done, total, itemId: item.id, state, ...(extra.reason ? { reason: extra.reason } : {}) });
		};

		for (const item of items) {
			if (item.state !== "pending") continue;
			if (!kept(item)) {
				await settle(item, "discarded");
				continue;
			}
			if ([...refsIn(item.input)].some((ref) => !outputs.has(ref))) {
				await settle(item, "skipped", { reason: { key: "proposals.dependsOnSkipped" } });
				continue;
			}
			const operation = operations.get(item.operation);
			if (!operation) {
				await settle(item, "failed", { reason: { key: "errors.unknown-operation" } });
				continue;
			}
			const resolved = mapRefs(item.input, (itemId) => (outputs.get(itemId) as { id?: unknown } | null)?.id);
			const { versions, input } = following(operation, item, resolved, moved);
			try {
				const result = await write(operation, input, {
					actor: "assistant",
					versions,
					conversationId: proposal.conversation_id,
					proposalItemId: item.id,
				});
				outputs.set(item.id, result.output);
				note(moved, item.base_versions, result.versions);
				await settle(item, "applied", {
					output: result.output,
					activityId: result.activityId,
					after: result.versions,
				});
			} catch (error) {
				if (error instanceof ConflictError) await settle(item, "stale", { reason: { key: "proposals.changed" } });
				else
					await settle(item, "failed", {
						reason: isMontiError(error)
							? error instanceof CheckError || error instanceof ForbiddenError
								? error.reason
								: { key: `errors.${error.code}` }
							: { key: "errors.unexpected", values: { message: String(error) } },
					});
			}
		}
	} finally {
		await engine.db.updateTable("monti_proposal").set({ applying_until: null }).where("id", "=", proposalId).execute();
		await settleProposal(engine.db, proposalId);
	}
	return results;
}

/**
 * An apply that died between an item's write and the item's own row leaves a waiting item whose write is in the activity log. It is recorded as
 * applied from that row, with the versions the write left, so the next apply does not run it again or take its own write for someone else's change.
 */
async function settleWritten(db: Db, proposalId: string, results: ApplyResult): Promise<void> {
	const written = await db
		.selectFrom("monti_proposal_item")
		.innerJoin("monti_activity", "monti_activity.proposal_item_id", "monti_proposal_item.id")
		.select(["monti_proposal_item.id", "monti_activity.id as activityId"])
		.where("monti_proposal_item.proposal_id", "=", proposalId)
		.where("monti_proposal_item.state", "=", "pending")
		.where("monti_activity.undone_at", "is", null)
		.execute();
	for (const item of written) {
		const snapshots = await db
			.selectFrom("monti_activity_snapshot")
			.select(["kind", "record_id", "after_version"])
			.where("activity_id", "=", item.activityId)
			.execute();
		await db
			.updateTable("monti_proposal_item")
			.set({
				state: "applied",
				activity_id: item.activityId,
				after_versions: JSON.stringify(
					Object.fromEntries(
						snapshots.map((snapshot) => [
							recordKey({ kind: snapshot.kind, id: snapshot.record_id }),
							snapshot.after_version,
						]),
					),
				),
			})
			.where("id", "=", item.id)
			.execute();
		results.push({ itemId: item.id, state: "applied" });
	}
}

/** A proposal's status from its items': all still waiting, all thrown away, put back, all done, or some of each. */
export async function settleProposal(db: Db, proposalId: string): Promise<void> {
	const rows = await db
		.selectFrom("monti_proposal_item")
		.select("state")
		.where("proposal_id", "=", proposalId)
		.execute();
	const states = rows.map((row) => row.state);
	const only = (...allowed: ProposalItemState[]) => states.every((state) => allowed.includes(state));
	const status: Selectable<ProposalTable>["status"] = only("pending")
		? "pending"
		: only("discarded")
			? "discarded"
			: only("reverted", "discarded")
				? "reverted"
				: only("applied", "discarded")
					? "applied"
					: "partial";
	await db.updateTable("monti_proposal").set({ status }).where("id", "=", proposalId).execute();
}

/**
 * Puts back what applying a proposal changed (doc 10: the card's "모두 되돌리기"): each applied item's write is undone as the activity log undoes
 * it. A record changed since is left alone, and its item stays applied with that reason. Only items the apply engine applied are put back here: an
 * item taken in a screen was saved with the person's own changes, and that save is undone from the activity log.
 */
export async function revertProposal(
	engine: Engine,
	db: Db,
	proposalId: string,
): Promise<{ reverted: string[]; kept: string[] }> {
	const applied = (
		await db
			.selectFrom("monti_proposal_item")
			.innerJoin("monti_activity", "monti_activity.id", "monti_proposal_item.activity_id")
			.select([
				"monti_proposal_item.id",
				"monti_proposal_item.activity_id",
				"monti_proposal_item.position",
				"monti_proposal_item.base_versions",
				"monti_proposal_item.after_versions",
			])
			.where("monti_proposal_item.proposal_id", "=", proposalId)
			.where("monti_proposal_item.state", "=", "applied")
			.whereRef("monti_activity.proposal_item_id", "=", "monti_proposal_item.id")
			.orderBy("monti_proposal_item.position", "desc")
			.execute()
	).filter((item): item is typeof item & { activity_id: string } => item.activity_id !== null);
	const reverted: string[] = [];
	const kept: string[] = [];
	// Newest first, so a record two items changed goes back through both.
	for (const item of applied) {
		let whole = false;
		try {
			const plan = await undo(engine, db, item.activity_id);
			// Judged by the records the item changed. One it only held while it wrote (the folder an entry moved into) was not changed by it, and
			// putting another item back may have moved that one on.
			const changed = (ref: RecordRef) => {
				const key = recordKey(ref);
				return item.after_versions === null || item.after_versions[key] !== item.base_versions[key];
			};
			whole = !plan.skip.some(changed);
		} catch (error) {
			if (!(error instanceof ForbiddenError)) throw error;
		}
		if (whole) reverted.push(item.id);
		else kept.push(item.id);
		await db
			.updateTable("monti_proposal_item")
			.set(
				whole
					? { state: "reverted", reason: null }
					: { reason: JSON.stringify({ key: "activity.changedSince" } satisfies Message) },
			)
			.where("id", "=", item.id)
			.execute();
	}
	await settleProposal(db, proposalId);
	return { reverted, kept };
}

/** A record as a person knows it: its name, and where it is (an entry's address, a file's folder). */
export type RecordLabel = { title: string; detail: string | null };

/** What the records a proposal touches are called, for the card and the review (doc 10). A kind the core does not know is called by its id. */
export async function describeRecords(engine: Engine, db: Db, refs: RecordRef[]): Promise<Record<string, RecordLabel>> {
	const labels: Record<string, RecordLabel> = {};
	const ids = (kind: string) => [...new Set(refs.filter((ref) => ref.kind === kind).map((ref) => ref.id))];
	const schema = engine.site.schema();
	const entries = ids("entry");
	if (entries.length > 0)
		for (const entry of await db
			.selectFrom("entries")
			.select(["id", "title", "slug", "collection", "locale"])
			.where("id", "in", entries)
			.execute())
			labels[recordKey({ kind: "entry", id: entry.id })] = {
				title: entry.title,
				detail:
					entry.slug === "" ? null : (publicPath(schema, entry.collection, entry.slug, entry.locale) ?? entry.slug),
			};
	const folders = ids("folder");
	const media = ids("media");
	const files =
		media.length === 0
			? []
			: await db.selectFrom("media").select(["id", "name", "folder_id"]).where("id", "in", media).execute();
	const folderIds = [...new Set([...folders, ...files.flatMap((file) => (file.folder_id ? [file.folder_id] : []))])];
	const folderNames = new Map(
		folderIds.length === 0
			? []
			: (await db.selectFrom("folders").select(["id", "name"]).where("id", "in", folderIds).execute()).map((folder) => [
					folder.id,
					folder.name,
				]),
	);
	for (const id of folders) {
		const name = folderNames.get(id);
		if (name !== undefined) labels[recordKey({ kind: "folder", id })] = { title: name, detail: null };
	}
	for (const file of files)
		labels[recordKey({ kind: "media", id: file.id })] = {
			title: file.name,
			detail: file.folder_id ? (folderNames.get(file.folder_id) ?? null) : null,
		};
	return labels;
}

export type ProposalItemView = {
	id: string;
	operation: string;
	input: unknown;
	/** The name the assistant gave this kind of change; items with the same name are one group. */
	group: string;
	state: ProposalItemState;
	/** Waiting, and its record changed since it was made: it cannot be applied until it is made again. */
	stale: boolean;
	included: boolean;
	reason: Message | null;
	/** The records it would change (or changed), by `recordKey`. */
	targets: string[];
	thread: ItemExchange[];
	activityId: string | null;
};

export type ProposalView = {
	id: string;
	conversationId: string;
	runId: string | null;
	request: string;
	status: Selectable<ProposalTable>["status"];
	createdAt: Date;
	/** An apply is going on it right now. */
	applying: boolean;
	items: ProposalItemView[];
	/** The groups in the order their first item came. */
	groups: { label: string; itemIds: string[] }[];
	records: Record<string, RecordLabel>;
	/** `toApply`: waiting, kept in and not changed since: what "apply" would run. */
	counts: { toApply: number; applied: number; failed: number; stale: number; reverted: number };
};

/**
 * A proposal as the card and the review show it (doc 10). Each waiting item's versions are compared with the records as they are now: one whose
 * record changed in the meantime is marked, unless only this proposal's own applied items moved it and the item can follow them.
 */
export async function viewProposal(
	engine: Engine,
	operations: ReadonlyMap<string, AnyOperation>,
	db: Db,
	proposalId: string,
): Promise<ProposalView | null> {
	const proposal = await db.selectFrom("monti_proposal").selectAll().where("id", "=", proposalId).executeTakeFirst();
	if (!proposal) return null;
	const items = await itemsOf(db, proposalId);
	const moved = movedBy(items);
	const refs = items.flatMap((item) =>
		Object.keys(item.base_versions).map((key) => {
			const at = key.indexOf(":");
			return { kind: key.slice(0, at), id: key.slice(at + 1) };
		}),
	);
	const known = refs.filter((ref) => engine.recordKinds.has(ref.kind));
	const now = await loadRecords(engine, db, known);
	const views = items.map((item): ProposalItemView => {
		const operation = operations.get(item.operation);
		const expected =
			item.state === "pending" && operation
				? following(operation, item, withPlaceholders(item.input), moved).versions
				: item.base_versions;
		const stale =
			item.state === "stale" ||
			(item.state === "pending" &&
				Object.entries(expected).some(([key, version]) => now.has(key) && (now.get(key)?.version ?? null) !== version));
		return {
			id: item.id,
			operation: item.operation,
			input: item.input,
			group: item.group_label,
			state: item.state,
			stale,
			included: item.included,
			reason: item.reason,
			targets: Object.keys(item.after_versions ?? item.base_versions),
			thread: item.thread,
			activityId: item.activity_id,
		};
	});
	const groups: ProposalView["groups"] = [];
	for (const item of views) {
		const group = groups.find((each) => each.label === item.group);
		if (group) group.itemIds.push(item.id);
		else groups.push({ label: item.group, itemIds: [item.id] });
	}
	const count = (test: (item: ProposalItemView) => boolean) => views.filter(test).length;
	return {
		id: proposal.id,
		conversationId: proposal.conversation_id,
		runId: proposal.run_id,
		request: proposal.request,
		status: proposal.status,
		createdAt: proposal.created_at,
		applying: proposal.applying_until !== null && proposal.applying_until > engine.now(),
		items: views,
		groups,
		records: await describeRecords(engine, db, refs),
		counts: {
			toApply: count((item) => item.state === "pending" && item.included && !item.stale),
			applied: count((item) => item.state === "applied"),
			failed: count((item) => item.state === "failed" || item.state === "skipped"),
			stale: count((item) => item.stale),
			reverted: count((item) => item.state === "reverted"),
		},
	};
}

/**
 * Items a person took in a screen and saved with the screen's own write (doc 05): they become applied, tied to that write's activity row, so the
 * activity log shows them with ✦ and their conversation, and undoing the write undoes them. Only pending items are taken.
 */
export async function markApplied(
	trx: Transaction<Database>,
	itemIds: string[],
	activityId: string,
	records: RecordRef[],
): Promise<string | null> {
	if (itemIds.length === 0) return null;
	const accepted = [...new Set(itemIds)];
	const items = await trx
		.selectFrom("monti_proposal_item")
		.innerJoin("monti_proposal", "monti_proposal.id", "monti_proposal_item.proposal_id")
		.select([
			"monti_proposal_item.id",
			"monti_proposal_item.proposal_id",
			"monti_proposal_item.base_versions",
			"monti_proposal_item.state",
			"monti_proposal.conversation_id",
		])
		.where("monti_proposal_item.id", "in", accepted)
		.execute();
	if (items.length !== accepted.length) throw new CheckError({ key: "proposals.unknownAccepted" });
	const targets = new Set(records.map(recordKey));
	const pending = items.filter((item) => item.state === "pending");
	if (
		pending.some((item) => {
			const proposed = Object.keys(item.base_versions);
			return proposed.length === 0 || proposed.some((key) => !targets.has(key));
		})
	)
		throw new CheckError({ key: "proposals.wrongTarget" });
	if (pending.length === 0) return null;
	await trx
		.updateTable("monti_proposal_item")
		.set({ state: "applied", activity_id: activityId })
		.where(
			"id",
			"in",
			pending.map((item) => item.id),
		)
		.execute();
	for (const proposalId of new Set(pending.map((item) => item.proposal_id))) await settleProposal(trx, proposalId);
	return pending[0]?.conversation_id ?? null;
}
