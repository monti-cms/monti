import { type Insertable, type Kysely, type Selectable, sql, type Transaction } from "kysely";
import { randomUUID } from "../bytes";
import type { Database, ItemExchange, ProposalItemState, ProposalItemTable, ProposalTable } from "../db/schema";
import { publicPath } from "../entries/paths";
import { CheckError, ConflictError, ForbiddenError, isMontiError } from "../errors";
import { lockWithFiles } from "../media/uses";
import {
	type AnyOperation,
	type EmittedEvent,
	type Message,
	overlap,
	type Preview,
	type RecordRef,
	recordKey,
} from "../operation";
import { context, type Engine, loadRecords, parseInput, type RunOptions, type WriteResult } from "./execute";
import { planUndo, undoWithEvents } from "./undo";

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

/** How long an apply holds its proposal without saying it still does; an apply that died lets go after this. While it lives it says so every third of it. */
export const APPLY_LEASE_MS = 60_000;

/** The most items one proposal holds: the card, the review and an apply read them all at once. The assistant is told to ask for fewer. */
export const MOST_ITEMS = 500;

/** Makes a proposal. A run has one: asked for again by the same run (cut between making it and noting it), it gives the one it made. */
export async function createProposal(
	engine: Engine,
	conversationId: string,
	request: string,
	runId: string | null = null,
): Promise<string> {
	const id = randomUUID();
	const made = await engine.db
		.insertInto("monti_proposal")
		.values({
			id,
			conversation_id: conversationId,
			run_id: runId,
			request,
			status: "pending",
			created_at: engine.now(),
		})
		.onConflict((conflict) => conflict.column("run_id").where("run_id", "is not", null).doNothing())
		.returning("id")
		.executeTakeFirst();
	if (made) return made.id;
	const first = await engine.db
		.selectFrom("monti_proposal")
		.select("id")
		.where("run_id", "=", runId)
		.executeTakeFirstOrThrow();
	return first.id;
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

/** The places an item's write changes, as its operation names them; `null` for an operation that does not say. */
function placesOf(
	operations: ReadonlyMap<string, AnyOperation>,
	item: Pick<Item, "operation" | "input">,
): string[] | null {
	const operation = operations.get(item.operation);
	if (!operation?.places) return null;
	return operation.places(parseInput(operation, withPlaceholders(item.input)));
}

/**
 * Refuses a write that changes a place another waiting item of the proposal already changes, or a place that holds it or is held by it, whatever
 * the two operations are: a whole body saved and one of its blocks edited are the same place.
 */
function mustNotOverlap(
	operations: ReadonlyMap<string, AnyOperation>,
	operation: AnyOperation,
	input: unknown,
	waiting: Item[],
	except?: string,
) {
	if (!operation.places) return;
	const places = operation.places(input);
	for (const item of waiting) {
		if (item.id === except || item.state !== "pending") continue;
		const theirs = placesOf(operations, item);
		if (theirs?.some((place) => places.some((mine) => overlap(mine, place))))
			throw new CheckError({ key: "proposals.samePlace" });
	}
}

/**
 * What a caller that writes for something it may no longer hold (a run's request, which another request can take the run from) gives with its
 * write: called in the transaction that stores the item, with that transaction, after the item is written and before it is kept. It holds
 * whatever says the caller is still the one to write, and throws when it is not; nothing is stored then. After the item, not before: what
 * removes a conversation takes its proposals and their items first and its runs last, and a holder that held a run and then waited for the
 * proposal would wait on a removal that waits for the run.
 */
export type WriteHolder = (trx: Transaction<Database>) => Promise<void>;

const itemsOf = (db: Db, proposalId: string) =>
	db.selectFrom("monti_proposal_item").selectAll().where("proposal_id", "=", proposalId).orderBy("position").execute();

/**
 * Adds a write the assistant asked for to a proposal. Nothing changes: the write is rehearsed and rolled back. A write that names several records
 * through its `each` list becomes one item per record, so a person takes or leaves each. `group` is the name the assistant gave this kind of change.
 * `call` names the tool call that asks (a run and the call's id): its items are stored with it in one statement, so the same call run again after
 * a cut finds them and gives the same answer instead of proposing a second time. `holder` is asked in the transaction that stores them.
 */
export async function proposeItem(
	engine: Engine,
	operations: ReadonlyMap<string, AnyOperation>,
	proposalId: string,
	operation: AnyOperation,
	rawInput: unknown,
	options: { group?: string; call?: string; holder?: WriteHolder } = {},
): Promise<{ itemId: string; itemIds: string[]; preview: Preview | null }> {
	mustBeProposable(engine, operation);
	const known = await itemsOf(engine.db, proposalId);
	// The items this call made: also one that a request at its place has changed since, which the call must not make a second time.
	const made =
		options.call === undefined
			? []
			: known.filter((item) => item.made_by === options.call || item.origin === options.call);
	if (made.length > 0)
		return { itemId: made[0].id, itemIds: made.map((item) => item.id), preview: made[0].preview as Preview | null };
	const refs = refsIn(rawInput);
	for (const ref of refs)
		if (!known.some((item) => item.id === ref)) throw new Error(`Item ${ref} is not an earlier item of this proposal.`);
	const input = parseInput(operation, withPlaceholders(rawInput));
	mustNotOverlap(operations, operation, input, known);
	const parts = split(operation, rawInput);
	if (known.length + parts.length > MOST_ITEMS)
		throw new CheckError({ key: "proposals.tooMany", values: { most: MOST_ITEMS } });

	// The whole write is rehearsed once: its checks answer for all of it, and its preview says what all of it would do.
	const whole = await rehearse(engine, operation, input, refs.size === 0);
	const rows: Insertable<ProposalItemTable>[] = [];
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
			made_by: options.call ?? null,
			origin: options.call ?? null,
			preview: whole.preview === null ? null : JSON.stringify(whole.preview),
		});
	}
	await engine.db.transaction().execute(async (trx) => {
		await trx.insertInto("monti_proposal_item").values(rows).execute();
		await options.holder?.(trx);
	});
	await settleProposal(engine.db, proposalId);
	return { itemId: rows[0].id, itemIds: rows.map((row) => row.id), preview: whole.preview };
}

/**
 * Puts a new write in an item's place (doc 10): the item made again after its record changed, or changed by a request at its place. The item
 * keeps its id, its place in the proposal and what was asked of it; it waits again, kept in. `call` names the tool call that asks, as in
 * `proposeItem`: run again, it finds the item it already made.
 */
export async function replaceItem(
	engine: Engine,
	operations: ReadonlyMap<string, AnyOperation>,
	itemId: string,
	operation: AnyOperation,
	rawInput: unknown,
	options: { call?: string; holder?: WriteHolder } = {},
): Promise<{ itemId: string; preview: Preview | null }> {
	mustBeProposable(engine, operation);
	const item = await engine.db
		.selectFrom("monti_proposal_item")
		.selectAll()
		.where("id", "=", itemId)
		.executeTakeFirst();
	if (item && options.call !== undefined && item.made_by === options.call)
		return { itemId, preview: item.preview as Preview | null };
	if (!item || !["pending", "stale", "failed"].includes(item.state))
		throw new CheckError({ key: "proposals.notWaiting" });
	if (split(operation, rawInput).length > 1) throw new CheckError({ key: "proposals.oneRecord" });
	// The same change, made again or made differently: the same operation, on the same records. A request at one change's place does not turn it
	// into a change of something else.
	if (operation.name !== item.operation) throw new CheckError({ key: "proposals.otherChange" });
	const input = parseInput(operation, withPlaceholders(rawInput));
	mustNotOverlap(operations, operation, input, await itemsOf(engine.db, item.proposal_id), itemId);
	const { baseVersions, preview } = await rehearse(engine, operation, input, refsIn(rawInput).size === 0);
	const [was, is] = [Object.keys(item.base_versions).sort(), Object.keys(baseVersions).sort()];
	if (was.length !== is.length || was.some((key, index) => key !== is[index]))
		throw new CheckError({ key: "proposals.otherChange" });
	// Only the item as it was read: one an apply took, a person discarded or another request changed meanwhile is left as it is.
	const replaced = await engine.db.transaction().execute(async (trx) => {
		const written = await trx
			.updateTable("monti_proposal_item")
			.set({
				operation: operation.name,
				input: JSON.stringify(rawInput),
				base_versions: JSON.stringify(baseVersions),
				state: "pending",
				reason: null,
				included: true,
				made_by: options.call ?? null,
				preview: preview === null ? null : JSON.stringify(preview),
			})
			.where("id", "=", itemId)
			.where("state", "=", item.state)
			.where("operation", "=", item.operation)
			.where(sql<boolean>`input = ${JSON.stringify(item.input)}::jsonb`)
			.returning("id")
			.executeTakeFirst();
		await options.holder?.(trx);
		return written;
	});
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

/** How far this proposal's own writes moved a record on, and the places they changed in it (`null`: one of them did not say). */
type Moved = Map<string, { from: number; to: number; places: string[] | null }>;

/**
 * How far this proposal's own writes have moved each record on: the version the first of them found (the reading the items were made on) and the
 * version the last of them left. A later item made on the same reading follows from there instead of being "changed in the meantime".
 */
function movedBy(operations: ReadonlyMap<string, AnyOperation>, items: Item[]) {
	const moved: Moved = new Map();
	for (const item of items) {
		if (item.state !== "applied" || !item.after_versions) continue;
		note(moved, item.base_versions, item.after_versions, placesOf(operations, item));
	}
	return moved;
}

function note(
	moved: Moved,
	base: Record<string, number>,
	after: Record<string, number | null>,
	places: string[] | null,
) {
	for (const [key, to] of Object.entries(after)) {
		const step = moved.get(key);
		const from = step?.from ?? base[key];
		if (to === null || from === undefined) moved.delete(key);
		else
			moved.set(key, {
				from,
				to,
				places: places === null || step?.places === null ? null : [...(step?.places ?? []), ...places],
			});
	}
}

/**
 * The versions and input an item is applied with. Where an earlier item of the same proposal moved a record on from the reading this one was made
 * on, a write that can follow (`follows`) is brought to the version the earlier one left; one that cannot keeps its own, and will be found changed.
 * It follows only writes that named the places they changed, none of them its own: a block edit does not follow a save that brought a whole body.
 */
function following(
	operation: AnyOperation,
	item: Item,
	input: unknown,
	moved: Moved,
): { versions: Record<string, number>; input: unknown } {
	const ahead = Object.entries(item.base_versions).filter(([key, base]) => {
		const step = moved.get(key);
		return step !== undefined && step.from === base && step.to !== base;
	});
	if (ahead.length === 0 || !operation.follows || !operation.places) return { versions: item.base_versions, input };
	const places = operation.places(input);
	const clear = ahead.every(([key]) => {
		const theirs = moved.get(key)?.places;
		return (
			theirs !== null && theirs !== undefined && !theirs.some((place) => places.some((mine) => overlap(mine, place)))
		);
	});
	if (!clear) return { versions: item.base_versions, input };
	const versions = {
		...item.base_versions,
		...Object.fromEntries(ahead.map(([key]) => [key, moved.get(key)?.to as number])),
	};
	const followed = operation.follows(input, versions);
	return followed === null ? { versions: item.base_versions, input } : { versions, input: followed };
}

/** What an apply shows to take an item as its own inside the item's write (`RunOptions.applies`). */
export type ItemClaim = {
	itemId: string;
	/** The apply's name on the proposal: another name there means its hold ran out and another apply took the proposal. */
	token: string;
	/** The write as the apply read it: an item changed since (made again, asked about at its place) is not the one it meant. */
	operation: string;
	input: unknown;
	/** The stored check decides whether the item is kept; `false` when the caller named the kept items itself. */
	checked: boolean;
};

/** The item is not this apply's to write: `taken`, another apply holds the proposal; `gone`, the item is no longer waiting as it was read. */
export class ClaimLost extends Error {
	constructor(readonly why: "taken" | "gone") {
		super(why === "taken" ? "Another apply holds the proposal." : "The item is no longer waiting as it was read.");
	}
}

/**
 * Takes an item for its write, or refuses with `ClaimLost`. With `lock`, in the write's transaction: the item's row is held until the write ends,
 * so discarding it, leaving it out, changing it and applying it elsewhere all wait and then find it applied.
 */
export async function claimItem(db: Db, claim: ItemClaim, lock: boolean): Promise<void> {
	const query = db
		.selectFrom("monti_proposal_item")
		.select(["proposal_id", "state", "included", "operation", "input"])
		.where("id", "=", claim.itemId);
	const item = await (lock ? query.forUpdate() : query).executeTakeFirst();
	const same =
		item !== undefined &&
		item.state === "pending" &&
		(!claim.checked || item.included) &&
		item.operation === claim.operation &&
		JSON.stringify(item.input) === JSON.stringify(claim.input);
	if (!item || !same) throw new ClaimLost("gone");
	const proposal = await db
		.selectFrom("monti_proposal")
		.select("applying_token")
		.where("id", "=", item.proposal_id)
		.executeTakeFirst();
	if (proposal?.applying_token !== claim.token) throw new ClaimLost("taken");
}

/** Records an item as applied, in its write's transaction: what the write gave, its row in the activity log, and the versions it found and left. */
export async function settleApplied(
	db: Db,
	itemId: string,
	written: {
		output: unknown;
		activityId: string | null;
		after: Record<string, number | null>;
		from: Record<string, number | null>;
	},
): Promise<void> {
	await db
		.updateTable("monti_proposal_item")
		.set({
			state: "applied",
			reason: null,
			output: written.output === undefined ? null : JSON.stringify(written.output),
			activity_id: written.activityId,
			after_versions: JSON.stringify(written.after),
			from_versions: JSON.stringify(written.from),
		})
		.where("id", "=", itemId)
		.execute();
}

/**
 * Applies a proposal's waiting items the person kept, in order, each as its own write on the same path a person's write takes. Items left out are
 * dropped. There is no transaction around the whole: an item that fails or changed in the meantime is recorded with its reason and the rest go
 * on. Each item is read again when its turn comes and is recorded as applied inside its own write, so an item discarded, left out or changed
 * while the apply ran is not written, and an apply cut short goes on with what is left when it is run again. `include`, when given, says which
 * items are kept instead of the stored checks.
 *
 * One apply at a time: it puts its name on the proposal and says every third of `leaseMs` that it still holds it. An apply that stopped saying so
 * (it died, or hung) is replaced by the next one, and if it comes back it finds another name and stops.
 */
export async function applyProposal(
	engine: Engine,
	operations: ReadonlyMap<string, AnyOperation>,
	proposalId: string,
	include: string[] | undefined,
	write: <Output>(operation: AnyOperation, input: unknown, options: RunOptions) => Promise<WriteResult<Output>>,
	onProgress?: (progress: ApplyProgress) => void | Promise<void>,
	leaseMs: number = APPLY_LEASE_MS,
): Promise<ApplyResult> {
	const token = randomUUID();
	// The writes of this application are one line of the activity log (doc 13).
	const batch: RunOptions["batch"] = {};
	const lease = () => new Date(engine.now().getTime() + leaseMs);
	const proposal = await engine.db
		.updateTable("monti_proposal")
		.set({ applying_until: lease(), applying_token: token })
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
	// A write can take longer than one hold: the apply keeps saying it is there for as long as it lives.
	const held = setInterval(() => {
		void engine.db
			.updateTable("monti_proposal")
			.set({ applying_until: lease() })
			.where("id", "=", proposalId)
			.where("applying_token", "=", token)
			.execute()
			.catch(() => {});
	}, leaseMs / 3);
	const results: ApplyResult = [];
	try {
		const first = await itemsOf(engine.db, proposalId);
		let outputs = new Map(first.filter((item) => item.state === "applied").map((item) => [item.id, item.output]));
		let moved = movedBy(operations, first);
		/**
		 * What the proposal's applied items gave and how far they moved the records, read again. An apply that took the proposal over from one still
		 * in its last write learns of that write here: it had to wait for it at the item's row, so the write is in by now.
		 */
		const readAgain = async () => {
			const now = await itemsOf(engine.db, proposalId);
			outputs = new Map(now.filter((item) => item.state === "applied").map((item) => [item.id, item.output]));
			moved = movedBy(operations, now);
		};
		const kept = (item: Item) => (include ? include.includes(item.id) : item.included);
		const counted = new Set(first.filter((item) => item.state === "pending" && kept(item)).map((item) => item.id));
		let total = counted.size;
		let done = 0;

		const report = async (itemId: string, state: ProposalItemState, reason?: Message) => {
			results.push({ itemId, state, ...(reason ? { reason } : {}) });
			if (state === "discarded") return;
			done += 1;
			// Whoever watches may be gone (the browser left, its stream broke): the apply runs to its end all the same (doc 00).
			try {
				await onProgress?.({ done, total, itemId, state, ...(reason ? { reason } : {}) });
			} catch {}
		};
		/** An item that left the apply's hands (discarded, taken in a screen, changed) is no longer one of the items it counts to. */
		const dropped = (itemId: string) => {
			if (counted.delete(itemId)) total -= 1;
		};
		/** Records why a waiting item was not written. Only while it still waits: what a person did to it meanwhile stands. */
		const settle = async (item: Item, state: "discarded" | "skipped" | "failed" | "stale", reason?: Message) => {
			const set = await engine.db
				.updateTable("monti_proposal_item")
				.set({ state, reason: reason ? JSON.stringify(reason) : null })
				.where("id", "=", item.id)
				.where("state", "=", "pending")
				.$if(state === "discarded" && include === undefined, (query) => query.where("included", "=", false))
				.returning("id")
				.executeTakeFirst();
			if (set) await report(item.id, state, reason);
			else dropped(item.id);
		};

		for (const { id } of first.filter((item) => item.state === "pending")) {
			// An apply whose hold another took stops before it touches the next item.
			const holder = await engine.db
				.selectFrom("monti_proposal")
				.select("applying_token")
				.where("id", "=", proposalId)
				.executeTakeFirst();
			if (holder?.applying_token !== token) throw new CheckError({ key: "proposals.applying" });
			// The item as it is now, not as it was when the apply began.
			const item = await engine.db
				.selectFrom("monti_proposal_item")
				.selectAll()
				.where("id", "=", id)
				.executeTakeFirst();
			if (!item || item.state !== "pending") {
				dropped(id);
				await readAgain();
				continue;
			}
			if (!kept(item)) {
				await settle(item, "discarded");
				continue;
			}
			if ([...refsIn(item.input)].some((ref) => !outputs.has(ref))) {
				await settle(item, "skipped", { key: "proposals.dependsOnSkipped" });
				continue;
			}
			const operation = operations.get(item.operation);
			if (!operation) {
				await settle(item, "failed", { key: "errors.unknown-operation" });
				continue;
			}
			const resolved = mapRefs(item.input, (itemId) => (outputs.get(itemId) as { id?: unknown } | null)?.id);
			const { versions, input } = following(operation, item, resolved, moved);
			let written = false;
			try {
				const result = await write(operation, input, {
					actor: "assistant",
					versions,
					conversationId: proposal.conversation_id,
					proposalId,
					batch,
					applies: {
						itemId: item.id,
						token,
						operation: item.operation,
						input: item.input,
						checked: include === undefined,
					},
				});
				outputs.set(item.id, result.output);
				note(moved, item.base_versions, result.versions, placesOf(operations, item));
				written = true;
			} catch (error) {
				if (error instanceof ClaimLost) {
					if (error.why === "taken") throw new CheckError({ key: "proposals.applying" });
					dropped(item.id);
					await readAgain();
				} else if (error instanceof ConflictError) await settle(item, "stale", { key: "proposals.changed" });
				else
					await settle(
						item,
						"failed",
						isMontiError(error)
							? error instanceof CheckError || error instanceof ForbiddenError
								? error.reason
								: { key: `errors.${error.code}` }
							: { key: "errors.unexpectedWith", values: { message: String(error) } },
					);
			}
			// Outside the write's own failures: nothing that goes wrong in telling of it turns an applied item into a failed one.
			if (written) await report(item.id, "applied");
		}
	} finally {
		clearInterval(held);
		// Only its own hold: one another apply took is that apply's to let go.
		await engine.db
			.updateTable("monti_proposal")
			.set({ applying_until: null, applying_token: null })
			.where("id", "=", proposalId)
			.where("applying_token", "=", token)
			.execute();
		await settleProposal(engine.db, proposalId);
	}
	return results;
}

/**
 * Holds the rows of the proposals named, or of the proposals the items named belong to, until the transaction ends. Whatever decides about a
 * proposal as a whole takes them first, before any record or item: a screen's save that accepts items, a discard, a revert, the status.
 */
export async function lockProposals(db: Db, of: { proposals?: string[]; items?: string[] }): Promise<void> {
	const ids = new Set(of.proposals ?? []);
	if (of.items && of.items.length > 0)
		for (const row of await db
			.selectFrom("monti_proposal_item")
			.select("proposal_id")
			.where("id", "in", of.items)
			.execute())
			ids.add(row.proposal_id);
	if (ids.size === 0) return;
	await db
		.selectFrom("monti_proposal")
		.select("id")
		.where("id", "in", [...ids])
		.orderBy("id")
		.forUpdate()
		.execute();
}

/**
 * A proposal's status from its items': all still waiting, all thrown away, put back, all done, or some of each. The proposal's row is held while
 * the items are read, so two that settle at once (an apply ending, a discard beside it) do not write an older reading over a newer one.
 */
export async function settleProposal(db: Db, proposalId: string): Promise<void> {
	const settle = async (trx: Db) => {
		await lockProposals(trx, { proposals: [proposalId] });
		const rows = await trx
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
		await trx.updateTable("monti_proposal").set({ status }).where("id", "=", proposalId).execute();
	};
	if (db.isTransaction) await settle(db);
	else await db.transaction().execute(settle);
}

/**
 * Puts back what applying a proposal changed (doc 10: the card's "revert all"): each applied item's write is undone as the activity log undoes
 * it, events and all, newest first. Only items the apply engine applied are put back here: an item taken in a screen was saved with the person's
 * own changes, and that save is undone from the activity log.
 *
 * - A record changed since is left alone. An item of which something went back is `reverted`, with how many of its records stayed; its write is
 *   undone and cannot be undone again. An item of which nothing could go back stays `applied` with that reason, and its write is not marked
 *   undone, so the activity log can still undo it.
 * - A write that cannot be undone at all (one that touched no record, a structure change, one older than the undo's 30 days) stays `applied`
 *   with the undo's own reason.
 * - Two items that changed one record go back through both. Putting the later one back gives the record a new version, which is not the one the
 *   earlier write left; the undo records the version it left, and the undo of the earlier write reads it as the one that write left.
 * - Not while an apply holds the proposal. The proposal's row is held to the end, so a second revert beside this one waits and then finds
 *   nothing left to put back.
 */
export async function revertProposal(
	engine: Engine,
	db: Db,
	proposalId: string,
	/** Each event with the write it undid: the line its delivery shows on. */
	emit: (event: EmittedEvent, undone: string) => void,
): Promise<{ reverted: string[]; kept: string[] }> {
	await lockProposals(db, { proposals: [proposalId] });
	const proposal = await db
		.selectFrom("monti_proposal")
		.select("applying_until")
		.where("id", "=", proposalId)
		.executeTakeFirst();
	if (!proposal) throw new CheckError({ key: "proposals.unknown" });
	if (proposal.applying_until !== null && proposal.applying_until > engine.now())
		throw new CheckError({ key: "proposals.applying" });
	const applied = (
		await db
			.selectFrom("monti_proposal_item")
			.innerJoin("monti_activity", "monti_activity.id", "monti_proposal_item.activity_id")
			.select([
				"monti_proposal_item.id",
				"monti_proposal_item.activity_id",
				"monti_proposal_item.position",
				"monti_proposal_item.base_versions",
				"monti_proposal_item.from_versions",
				"monti_proposal_item.after_versions",
			])
			.where("monti_proposal_item.proposal_id", "=", proposalId)
			.where("monti_proposal_item.state", "=", "applied")
			.whereRef("monti_activity.proposal_item_id", "=", "monti_proposal_item.id")
			.orderBy("monti_proposal_item.position", "desc")
			.execute()
	).filter((item): item is typeof item & { activity_id: string } => item.activity_id !== null);
	// Everything the revert will hold, taken once and in the engine's one order before any item is put back: the proposal's row (above), then
	// the items' activity rows, then every record their snapshots name, sorted. The undo of each item then waits for nothing. Taken item by
	// item instead, a later item's records would be held while an earlier item's are asked for, against a person's write that takes the same
	// records in sorted order: each would wait for the other.
	const writes = applied.map((item) => item.activity_id);
	if (writes.length > 0) {
		await db
			.selectFrom("monti_activity")
			.select("id")
			.where("id", "in", writes)
			.orderBy("seq", "desc")
			.forUpdate()
			.execute();
		const snapshots = await db
			.selectFrom("monti_activity_snapshot")
			.select(["kind", "record_id", "before"])
			.where("activity_id", "in", writes)
			.execute();
		// And the files those records will name once they are back, in the same go (`lockWithFiles`).
		await lockWithFiles(
			db,
			engine.site.schema(),
			[
				...new Map(
					snapshots.map((snapshot) => {
						const ref = { kind: snapshot.kind, id: snapshot.record_id };
						return [recordKey(ref), ref] as const;
					}),
				).values(),
			],
			{ willHold: snapshots.map((snapshot) => snapshot.before) },
		);
	}
	const reverted: string[] = [];
	const kept: string[] = [];
	for (const item of applied) {
		let outcome: ItemOutcome;
		try {
			// The one way writes are taken back (doc 13): the item's write, under the undo's locks. Two items that changed one record go back through
			// both: the undo of the later one records the version it left, and the undo of the earlier one reads it as its own.
			const of = { write: item.activity_id };
			const plan = await planUndo(engine, db, of, { lock: true });
			outcome = outcomeOf(item, plan.restore, plan.skip, plan.same);
			// As the activity log's undo: what it changes of the site is told to the receivers (an entry off the site again). When nothing of
			// what the item changed can go back, the write is left as it is, not used up as undone.
			if (outcome.state === "reverted") await undoWithEvents(engine, db, of, emit);
		} catch (error) {
			if (!(error instanceof ForbiddenError)) throw error;
			// The undo's own word: it cannot be undone, its time is over, or it was undone already (from the activity log).
			outcome = { state: "applied", reason: error.reason };
		}
		if (outcome.state === "reverted") reverted.push(item.id);
		else kept.push(item.id);
		await setOutcome(db, item.id, outcome);
	}
	await settleProposal(db, proposalId);
	return { reverted, kept };
}

/** What becomes of an applied item once an undo went through its write: put back (with a word when part of it stayed), or still applied, with why. */
type ItemOutcome = { state: "reverted"; reason: Message | null } | { state: "applied"; reason: Message };

/**
 * The one rule for an item whose write is taken back, whoever takes it back ("revert all", or the activity log's undo of its line). `back` are
 * the records of the write that go back, `stayed` the ones that do not (someone wrote them since), `same` the ones that hold what they held
 * before it already (the same value written again): nothing of those goes back, and they are as much "put back" as any.
 *
 * It is judged by the records the item changed. One it only held while it wrote (the folder an entry moved into) was not changed by it, and
 * putting another item back may have moved that one on. Put back when a record it changed goes back, saying how many of them stayed, or when
 * all it changed hold what they held. Otherwise still applied: "changed since" when a record it changed was written since, "nothing to
 * undo" when it changed none.
 */
function outcomeOf(
	item: {
		base_versions: Record<string, number | null>;
		from_versions: Record<string, number | null> | null;
		after_versions: Record<string, number | null> | null;
	},
	back: RecordRef[],
	stayed: RecordRef[],
	same: RecordRef[],
): ItemOutcome {
	const found = item.from_versions ?? item.base_versions;
	const changed = (ref: RecordRef) => {
		const key = recordKey(ref);
		return item.after_versions === null || item.after_versions[key] !== (found[key] ?? null);
	};
	const count = stayed.filter(changed).length;
	// Not put back: what it changed was written since, or it changed nothing that can be put back (it only held its records).
	if (!back.some(changed) && !(same.some(changed) && count === 0))
		return { state: "applied", reason: { key: count > 0 ? "activity.changedSince" : "activity.nothingToUndo" } };
	return { state: "reverted", reason: count > 0 ? { key: "proposals.partlyReverted", values: { count } } : null };
}

const setOutcome = (db: Db, itemId: string, outcome: ItemOutcome) =>
	db
		.updateTable("monti_proposal_item")
		.set({ state: outcome.state, reason: outcome.reason === null ? null : JSON.stringify(outcome.reason) })
		.where("id", "=", itemId)
		.execute();

/**
 * The proposals whose applied items made these writes, for an undo from the activity log to take their rows first (the engine's order: proposal
 * rows, then activity rows, then records).
 */
export async function proposalsOfWrites(db: Db, of: { line: string } | { proposal: string } | { write: string }) {
	if ("proposal" in of) return [of.proposal];
	const rows = await db
		.selectFrom("monti_activity")
		.select("proposal_id")
		.where((eb) =>
			"write" in of ? eb("id", "=", of.write) : eb.or([eb("id", "=", of.line), eb("line", "=", of.line)]),
		)
		.where("proposal_id", "is not", null)
		.execute();
	return [...new Set(rows.flatMap((row) => row.proposal_id ?? []))];
}

/**
 * Says of the proposal items whose writes an undo from the activity log took back what "revert all" would have said of them (`outcomeOf`, the
 * one rule): the conversation's card and a later "revert all" then agree with the log, whichever of the two undid the write. `put` names, for
 * each write the undo went through, the records it put back. The caller holds the proposals' rows.
 */
export async function markReverted(
	db: Db,
	put: { write: string; back: RecordRef[]; same: RecordRef[] }[],
): Promise<void> {
	if (put.length === 0) return;
	const writes = put.map((each) => each.write);
	const items = await db
		.selectFrom("monti_proposal_item")
		.select(["id", "proposal_id", "activity_id", "base_versions", "from_versions", "after_versions"])
		.where("activity_id", "in", writes)
		.where("state", "=", "applied")
		.execute();
	if (items.length === 0) return;
	const snapshots = await db
		.selectFrom("monti_activity_snapshot")
		.select(["activity_id", "kind", "record_id"])
		.where("activity_id", "in", writes)
		.execute();
	for (const item of items) {
		const { back, same } = put.find((each) => each.write === item.activity_id) ?? { back: [], same: [] };
		const went = new Set([...back, ...same].map(recordKey));
		// The write's other records: what it holds a snapshot of and the undo left as it is.
		const stayed = snapshots
			.filter((snapshot) => snapshot.activity_id === item.activity_id)
			.map((snapshot) => ({ kind: snapshot.kind, id: snapshot.record_id }))
			.filter((ref) => !went.has(recordKey(ref)));
		await setOutcome(db, item.id, outcomeOf(item, back, stayed, same));
	}
	for (const proposalId of new Set(items.map((item) => item.proposal_id))) await settleProposal(db, proposalId);
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
	const moved = movedBy(operations, items);
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

/** A pending proposal item a person took into a screen's draft, as the write that saves the draft finds it. */
type TakenItem = {
	id: string;
	proposalId: string;
	conversationId: string /** The records it is aimed at, by key. */;
	records: string[];
};

/**
 * The items a person took in a screen and saves with the screen's own write (doc 05), checked before the write runs: each must exist, and each
 * pending one must be aimed at a record this write touches. One record is enough: a person may take an item and put part of it back before saving
 * (its change of the site's name undone, its change of the languages kept), and the part that is kept is saved with the item. An item aimed at none
 * of the write's records belongs to another screen and refuses the write, before it has written anything.
 */
export async function acceptedItems(
	trx: Transaction<Database>,
	itemIds: string[],
	touched: RecordRef[],
): Promise<TakenItem[]> {
	if (itemIds.length === 0) return [];
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
		// Held until the write ends, so two writes cannot both take the same item.
		.forUpdate()
		.execute();
	if (items.length !== accepted.length) throw new CheckError({ key: "proposals.unknownAccepted" });
	const targets = new Set(touched.map(recordKey));
	const pending = items.filter((item) => item.state === "pending");
	if (pending.some((item) => !Object.keys(item.base_versions).some((key) => targets.has(key))))
		throw new CheckError({ key: "proposals.wrongTarget" });
	return pending.map((item) => ({
		id: item.id,
		proposalId: item.proposal_id,
		conversationId: item.conversation_id,
		records: Object.keys(item.base_versions),
	}));
}

/**
 * Marks the taken items applied, tied to the write's activity row, so the activity log shows them with ✦ and their conversation, and undoing the
 * write undoes them. Run after the write itself, in its transaction: a write that fails leaves them pending.
 */
export async function markApplied(
	trx: Transaction<Database>,
	taken: TakenItem[],
	activityId: string,
): Promise<{ conversationId: string; proposalId: string } | null> {
	if (taken.length === 0) return null;
	await trx
		.updateTable("monti_proposal_item")
		.set({ state: "applied", activity_id: activityId })
		.where(
			"id",
			"in",
			taken.map((item) => item.id),
		)
		.execute();
	for (const proposalId of new Set(taken.map((item) => item.proposalId))) await settleProposal(trx, proposalId);
	const [first] = taken;
	return first ? { conversationId: first.conversationId, proposalId: first.proposalId } : null;
}
