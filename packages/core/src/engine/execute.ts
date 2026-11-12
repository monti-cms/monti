import type { Kysely, Transaction } from "kysely";
import type { Session } from "../auth/session";
import { randomUUID } from "../bytes";
import type { Database } from "../db/schema";
import { ConflictError, ForbiddenError, InputError } from "../errors";
import { rewriteUses } from "../media/uses";
import {
	type Actor,
	type AnyOperation,
	type MontiEvent,
	type OperationContext,
	type RecordRef,
	recordKey,
} from "../operation";
import { lockRecords, type RecordKind, type RecordState } from "../records";
import { markUnapplied } from "../schema/apply";
import type { Site } from "../site";
import { queueDeliveries, type Receiver } from "./deliveries";
import { acceptedItems, claimItem, type ItemClaim, lockProposals, markApplied, settleApplied } from "./proposals";

/** How long a write can be undone. The trash keeps entries as long, and both are cleared together (doc 11). */
export const UNDO_DAYS = 30;

export type Engine = {
	db: Kysely<Database>;
	recordKinds: ReadonlyMap<string, RecordKind>;
	receivers: readonly Receiver[];
	site: Site;
	now: () => Date;
};

export type RunOptions = {
	actor: Actor;
	/** The versions the caller read, by `recordKey`. A touched record at another version is a conflict. */
	versions?: Record<string, number>;
	conversationId?: string;
	/**
	 * The write applies this proposal item. Inside its transaction the item is claimed (still waiting, still the write that was read, still kept,
	 * and the apply still holds the proposal) and, when the write is done, recorded as applied with what it gave: both or neither.
	 */
	applies?: ItemClaim;
	/** The admin API's session, for the operations that read or end it. */
	session?: Session | null;
	/** Proposal items the person took in the screen and saves with this write (doc 05): they become applied, tied to its activity row. */
	accepted?: string[];
};

export type WriteResult<Output> = {
	output: Output;
	/** The write's row in the activity log; `null` for a write that only keeps the assistant's books and leaves none. */
	activityId: string | null;
	/** The touched and created records' versions after the write, `null` for one it removed. */
	versions: Record<string, number | null>;
	/** The deliveries the write queued, to send now that it has committed. */
	deliveryIds: string[];
};

export function parseInput(operation: AnyOperation, input: unknown): unknown {
	const parsed = operation.input.safeParse(input);
	if (!parsed.success) throw new InputError(parsed.error.issues);
	return parsed.data;
}

export function context(
	engine: Engine,
	db: Kysely<Database> | Transaction<Database>,
	actor: Actor,
	session: Session | null = null,
) {
	const events: MontiEvent[] = [];
	const created: RecordRef[] = [];
	const flags: { structure: boolean; change: string | null } = { structure: false, change: null };
	const ctx: OperationContext = {
		db,
		actor,
		emit: (event) => events.push(event),
		created: (ref) => created.push(ref),
		changedStructure: (changeId) => {
			flags.structure = true;
			flags.change = changeId;
		},
		site: engine.site,
		now: engine.now,
		session,
	};
	return { ctx, events, created, flags };
}

/** Runs a read: no transaction, no log. */
export async function runRead(
	engine: Engine,
	operation: AnyOperation,
	input: unknown,
	actor: Actor,
	session: Session | null = null,
): Promise<unknown> {
	return operation.run(parseInput(operation, input), context(engine, engine.db, actor, session).ctx, undefined);
}

/** The current state of each record, `null` where it does not exist. */
export async function loadRecords(
	engine: Engine,
	db: Kysely<Database> | Transaction<Database>,
	refs: RecordRef[],
): Promise<Map<string, RecordState | null>> {
	const states = new Map<string, RecordState | null>();
	const byKind = new Map<string, string[]>();
	for (const ref of refs) byKind.set(ref.kind, [...(byKind.get(ref.kind) ?? []), ref.id]);
	for (const [kind, ids] of byKind) {
		const recordKind = engine.recordKinds.get(kind);
		if (!recordKind) throw new Error(`No record kind "${kind}"; define it with defineRecordKind.`);
		const found = new Map((await recordKind.load(db, ids)).map((state) => [state.id, state]));
		for (const id of ids) states.set(recordKey({ kind, id }), found.get(id) ?? null);
	}
	return states;
}

const unique = (refs: RecordRef[]) => [...new Map(refs.map((ref) => [recordKey(ref), ref])).values()];

/**
 * Runs a write the one way every caller does: check the input, then in one transaction compare versions, snapshot what it touches, run it, log it
 * and queue its events. The events go out only after the commit; a write that fails leaves no row, no snapshot and no event.
 */
export async function runWrite<Output>(
	engine: Engine,
	operation: AnyOperation,
	rawInput: unknown,
	options: RunOptions,
): Promise<WriteResult<Output>> {
	if (operation.humanOnly && options.actor === "assistant")
		throw new ForbiddenError({ key: "errors.humanOnly", values: { operation: operation.name } });
	if (operation.structure && engine.site.files === null)
		throw new ForbiddenError({ key: "errors.structureLocked", values: { operation: operation.name } });
	const input = parseInput(operation, rawInput);
	// A write of the assistant's own books leaves no row of the log for a taken item to be tied to: the two together are a mistake of the
	// caller's, said at once and not left to end with the items checked and never marked.
	if (operation.bookkeeping && options.accepted && options.accepted.length > 0)
		throw new Error(
			`Operation "${operation.name}" keeps the assistant's books and cannot save accepted proposal items.`,
		);
	const activityId = operation.bookkeeping ? null : randomUUID();
	/** Refuses the write when a record it touches or holds is not at the version the caller read. */
	const mustBeAsRead = (refs: RecordRef[], states: Map<string, RecordState | null>) => {
		const conflicts = refs.flatMap((ref) => {
			const expected = options.versions?.[recordKey(ref)];
			const actual = states.get(recordKey(ref))?.version ?? null;
			return expected === undefined || expected === actual ? [] : [{ ref, expected, actual }];
		});
		if (conflicts.length > 0) throw new ConflictError(conflicts);
	};
	let prepared: unknown;
	if (operation.prepare) {
		const { ctx } = context(engine, engine.db, options.actor, options.session ?? null);
		// A caller whose reading is old is told so before anything is prepared: `prepare` may send what the record holds now to another service
		// (a key to the address the stale caller named). The transaction compares the versions again, under its locks.
		if (options.versions) {
			const touched = unique((await operation.touches?.(input, ctx)) ?? []);
			mustBeAsRead(touched, await loadRecords(engine, engine.db, touched));
		}
		// An item that is no longer this apply's to apply is not prepared for either.
		if (options.applies) await claimItem(engine.db, options.applies, false);
		// Before the transaction, with no connection held: a write that asks another service does it here (a key's check can take ten seconds).
		prepared = await operation.prepare(input, ctx);
	}
	// The change file a structure write left on disk: files are not rolled back with the database.
	const onDisk: { change: string | null } = { change: null };
	return engine.db
		.transaction()
		.execute((trx) => inTransaction(trx))
		.catch(async (error) => {
			// The write failed after its files were written (the activity row, a later step): the database is as it was and the files are saved.
			// That is the state "saved, not applied": recorded, so the admin offers "apply again" instead of reading the file as a hand edit.
			if (onDisk.change) await markUnapplied(engine.db, onDisk.change);
			throw error;
		});

	async function inTransaction(trx: Transaction<Database>): Promise<WriteResult<Output>> {
		const { ctx, events, created, flags } = context(engine, trx, options.actor, options.session ?? null);
		// A save that accepts proposal items decides about their proposals: those rows first, as a revert and a discard take them, then the
		// records. Before `touches` too: some operations already hold a record there (a move holds its folder), and a write that held a
		// record and then waited for the proposal would wait on a write that holds the proposal and waits for the record.
		if (options.accepted && options.accepted.length > 0) await lockProposals(trx, { items: options.accepted });
		const touched = unique((await operation.touches?.(input, ctx)) ?? []);
		// Held beside what the write touches: locked and compared with it, its own only where the write changes them (`holds`).
		const named = new Set(touched.map(recordKey));
		const held = unique((await operation.holds?.(input, ctx)) ?? []).filter((ref) => !named.has(recordKey(ref)));
		const locked = [...touched, ...held];
		await lockRecords(trx, locked);
		// After the records' locks, as a screen's save takes them (records, then the items it accepts): the item is held until this write ends, so
		// nothing discards it, changes it or applies it a second time meanwhile.
		if (options.applies) await claimItem(trx, options.applies, true);
		const before = await loadRecords(engine, trx, locked);
		mustBeAsRead(locked, before);

		// The proposal items the person took are checked before anything is written (a structure write changes files that no rollback takes back).
		const taken = await acceptedItems(trx, options.accepted ?? [], touched);
		await operation.check?.(input, ctx, prepared);
		let output: Output;
		try {
			output = (await operation.run(input, ctx, prepared)) as Output;
		} finally {
			// Known whether the run ended well or threw: the files it wrote are there either way.
			onDisk.change = flags.change;
		}

		const own = unique([...touched, ...created]);
		// Whatever the write did to a body or a field, what uses which media file is read from the result, here and nowhere else (doc 09).
		// What the records held before, so a file the library does not have is refused only when this write brings it in (doc 09).
		await rewriteUses(trx, engine.site.schema(), own, {
			before: touched.map((ref) => before.get(recordKey(ref)) ?? null),
		});
		const after = await loadRecords(engine, trx, unique([...own, ...held]));
		const versions = () => Object.fromEntries([...after].map(([key, state]) => [key, state?.version ?? null]));
		if (options.applies)
			await settleApplied(trx, options.applies.itemId, {
				output,
				activityId,
				after: versions(),
				from: Object.fromEntries(touched.map((ref) => [recordKey(ref), before.get(recordKey(ref))?.version ?? null])),
			});
		// The assistant's own books are not the site's history: no row, no snapshot, nothing sent.
		if (activityId === null) return { output, activityId, versions: versions(), deliveryIds: [] };
		// The records whose version the write moved: a taken proposal aimed at one of them is applied, and a record the write only held joins
		// its log and its undo when it is among them.
		const written = new Set(
			[...after].flatMap(([key, state]) =>
				(before.get(key)?.version ?? null) === (state?.version ?? null) ? [] : [key],
			),
		);
		const records = unique([...own, ...held.filter((ref) => written.has(recordKey(ref)))]);
		// What an undo puts back: the records of kinds that can be put back. The schema is versioned only, so a write that named it and left it
		// alone still undoes the rest.
		const restorable = records.filter((ref) => engine.recordKinds.get(ref.kind)?.restore !== undefined);
		const undoable = !operation.humanOnly && !operation.structure && !flags.structure && restorable.length > 0;
		const now = engine.now();
		await trx
			.insertInto("monti_activity")
			.values({
				id: activityId,
				at: now,
				actor: JSON.stringify(options.actor),
				operation: operation.name,
				summary: JSON.stringify(operation.summary?.(input, output) ?? { key: operation.name }),
				targets: JSON.stringify(records),
				conversation_id: options.conversationId ?? null,
				proposal_item_id: options.applies?.itemId ?? null,
				undo_until: undoable ? new Date(now.getTime() + UNDO_DAYS * 86_400_000) : null,
				undone_at: null,
			})
			.execute();
		if (undoable)
			await trx
				.insertInto("monti_activity_snapshot")
				.values(
					restorable.map((ref) => {
						const old = before.get(recordKey(ref));
						return {
							activity_id: activityId,
							kind: ref.kind,
							record_id: ref.id,
							before: old ? JSON.stringify(old.data) : null,
							after_version: after.get(recordKey(ref))?.version ?? null,
						};
					}),
				)
				.execute();
		// Taken proposals join this write: the row gets their conversation, so the log shows ✦ (doc 05). Only those the write wrote something of:
		// an item all of whose records are as they were (its change of the schema, when the file could not be written) stays pending.
		const conversation = await markApplied(
			trx,
			taken.filter((item) => item.records.some((key) => written.has(key))),
			activityId,
		);
		if (conversation && !options.conversationId)
			await trx
				.updateTable("monti_activity")
				.set({ conversation_id: conversation })
				.where("id", "=", activityId)
				.execute();
		const deliveryIds = await queueDeliveries(trx, engine.receivers, activityId, events);
		return { output, activityId, versions: versions(), deliveryIds };
	}
}
