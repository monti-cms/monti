import type { Kysely, Transaction } from "kysely";
import { randomUUID } from "../bytes";
import type { Database, ProposalItemState } from "../db/schema";
import { CheckError, ConflictError, ForbiddenError, isMontiError } from "../errors";
import { type AnyOperation, type Message, type Preview, type RecordRef, recordKey } from "../operation";
import { context, type Engine, loadRecords, parseInput, type RunOptions, type WriteResult } from "./execute";

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

class Rollback extends Error {}

export async function createProposal(engine: Engine, conversationId: string, request: string): Promise<string> {
	const id = randomUUID();
	await engine.db
		.insertInto("monti_proposal")
		.values({ id, conversation_id: conversationId, request, status: "pending" })
		.execute();
	return id;
}

/**
 * Adds a write the assistant asked for to a proposal. Nothing changes: the write's `check` and `preview` run in a transaction that is rolled back,
 * and the versions of the records it touches are kept, so applying it later can tell whether they changed in the meantime.
 */
export async function proposeItem(
	engine: Engine,
	proposalId: string,
	operation: AnyOperation,
	rawInput: unknown,
): Promise<{ itemId: string; preview: Preview | null }> {
	// Before the input is read at all: a proposal keeps its input as it came, and what only a person may run (a key to add, a password) must not be
	// kept anywhere. The same goes for what this site does not offer the assistant: signing in, and structure on the live site.
	if (operation.humanOnly || operation.open)
		throw new ForbiddenError({ key: "errors.humanOnly", values: { operation: operation.name } });
	if (operation.structure && engine.site.files === null)
		throw new ForbiddenError({ key: "errors.structureLocked", values: { operation: operation.name } });
	const refs = refsIn(rawInput);
	const known = await engine.db
		.selectFrom("monti_proposal_item")
		.select(["id", "position"])
		.where("proposal_id", "=", proposalId)
		.execute();
	for (const ref of refs)
		if (!known.some((item) => item.id === ref)) throw new Error(`Item ${ref} is not an earlier item of this proposal.`);
	const input = parseInput(
		operation,
		mapRefs(rawInput, (itemId) => placeholder(itemId)),
	);

	let baseVersions: Record<string, number> = {};
	let preview: Preview | null = null;
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
			if (refs.size === 0) await operation.check?.(input, ctx);
			preview = (await operation.preview?.(input, ctx)) ?? null;
			throw new Rollback();
		})
		.catch((error) => {
			if (!(error instanceof Rollback)) throw error;
		});

	const itemId = randomUUID();
	await engine.db
		.insertInto("monti_proposal_item")
		.values({
			id: itemId,
			proposal_id: proposalId,
			position: known.length,
			operation: operation.name,
			input: JSON.stringify(rawInput),
			base_versions: JSON.stringify(baseVersions),
			state: "pending",
			reason: null,
			output: null,
			activity_id: null,
		})
		.execute();
	return { itemId, preview };
}

export type ApplyResult = { itemId: string; state: ProposalItemState; reason?: Message }[];

/**
 * Applies a proposal's pending items in order, each as its own write on the same path a person's write takes. Items not in `include` are dropped.
 * There is no transaction around the whole: an item that fails or changed in the meantime is recorded with its reason and the rest go on.
 */
export async function applyProposal(
	engine: Engine,
	operations: ReadonlyMap<string, AnyOperation>,
	proposalId: string,
	include: string[] | undefined,
	write: <Output>(operation: AnyOperation, input: unknown, options: RunOptions) => Promise<WriteResult<Output>>,
): Promise<ApplyResult> {
	const proposal = await engine.db
		.selectFrom("monti_proposal")
		.select("conversation_id")
		.where("id", "=", proposalId)
		.executeTakeFirstOrThrow();
	const items = await engine.db
		.selectFrom("monti_proposal_item")
		.selectAll()
		.where("proposal_id", "=", proposalId)
		.orderBy("position")
		.execute();
	const outputs = new Map(items.filter((item) => item.state === "applied").map((item) => [item.id, item.output]));
	const results: ApplyResult = [];

	const settle = async (
		itemId: string,
		state: ProposalItemState,
		extra: { reason?: Message; output?: unknown; activityId?: string } = {},
	) => {
		await engine.db
			.updateTable("monti_proposal_item")
			.set({
				state,
				reason: extra.reason ? JSON.stringify(extra.reason) : null,
				output: extra.output === undefined ? null : JSON.stringify(extra.output),
				activity_id: extra.activityId ?? null,
			})
			.where("id", "=", itemId)
			.execute();
		results.push({ itemId, state, ...(extra.reason ? { reason: extra.reason } : {}) });
	};

	for (const item of items) {
		if (item.state !== "pending") continue;
		if (include && !include.includes(item.id)) {
			await settle(item.id, "discarded");
			continue;
		}
		if ([...refsIn(item.input)].some((ref) => !outputs.has(ref))) {
			await settle(item.id, "skipped", { reason: { key: "proposals.dependsOnSkipped" } });
			continue;
		}
		const operation = operations.get(item.operation);
		if (!operation) {
			await settle(item.id, "failed", { reason: { key: "errors.unknown-operation" } });
			continue;
		}
		const input = mapRefs(item.input, (itemId) => (outputs.get(itemId) as { id?: unknown } | null)?.id);
		try {
			const result = await write(operation, input, {
				actor: "assistant",
				versions: item.base_versions,
				conversationId: proposal.conversation_id,
				proposalItemId: item.id,
			});
			outputs.set(item.id, result.output);
			await settle(item.id, "applied", { output: result.output, activityId: result.activityId });
		} catch (error) {
			if (error instanceof ConflictError) await settle(item.id, "stale", { reason: { key: "proposals.changed" } });
			else
				await settle(item.id, "failed", {
					reason: isMontiError(error)
						? { key: `errors.${error.code}` }
						: { key: "errors.unexpected", values: { message: String(error) } },
				});
		}
	}

	await settleProposal(engine.db, proposalId);
	return results;
}

/** A proposal's status from its items': all still waiting, all thrown away, all done, or some of each. */
export async function settleProposal(db: Kysely<Database> | Transaction<Database>, proposalId: string): Promise<void> {
	const states = await db
		.selectFrom("monti_proposal_item")
		.select("state")
		.where("proposal_id", "=", proposalId)
		.execute();
	const status = states.every((row) => row.state === "pending")
		? "pending"
		: states.every((row) => row.state === "discarded")
			? "discarded"
			: states.every((row) => row.state === "applied" || row.state === "discarded")
				? "applied"
				: "partial";
	await db.updateTable("monti_proposal").set({ status }).where("id", "=", proposalId).execute();
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
