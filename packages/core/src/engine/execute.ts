import type { Kysely, Transaction } from "kysely";
import type { Session } from "../auth/session";
import { randomUUID } from "../bytes";
import type { Database } from "../db/schema";
import { ConflictError, ForbiddenError, InputError } from "../errors";
import {
	type Actor,
	type AnyOperation,
	type MontiEvent,
	type OperationContext,
	type RecordRef,
	recordKey,
} from "../operation";
import type { RecordKind, RecordState } from "../records";
import type { Site } from "../site";
import { queueDeliveries, type Receiver } from "./deliveries";

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
	proposalItemId?: string;
	/** The admin API's session, for the operations that read or end it. */
	session?: Session | null;
};

export type WriteResult<Output> = {
	output: Output;
	activityId: string;
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
	const ctx: OperationContext = {
		db,
		actor,
		emit: (event) => events.push(event),
		created: (ref) => created.push(ref),
		site: engine.site,
		now: engine.now,
		session,
	};
	return { ctx, events, created };
}

/** Runs a read: no transaction, no log. */
export async function runRead(
	engine: Engine,
	operation: AnyOperation,
	input: unknown,
	actor: Actor,
	session: Session | null = null,
): Promise<unknown> {
	return operation.run(parseInput(operation, input), context(engine, engine.db, actor, session).ctx);
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
	const activityId = randomUUID();
	return engine.db.transaction().execute(async (trx) => {
		const { ctx, events, created } = context(engine, trx, options.actor, options.session ?? null);
		const touched = unique((await operation.touches?.(input, ctx)) ?? []);
		const before = await loadRecords(engine, trx, touched);

		const conflicts = touched.flatMap((ref) => {
			const expected = options.versions?.[recordKey(ref)];
			const actual = before.get(recordKey(ref))?.version ?? null;
			return expected === undefined || expected === actual ? [] : [{ ref, expected, actual }];
		});
		if (conflicts.length > 0) throw new ConflictError(conflicts);

		await operation.check?.(input, ctx);
		const output = (await operation.run(input, ctx)) as Output;

		const records = unique([...touched, ...created]);
		const after = await loadRecords(engine, trx, records);
		const undoable = !operation.humanOnly && !operation.structure && records.length > 0;
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
				proposal_item_id: options.proposalItemId ?? null,
				undo_until: undoable ? new Date(now.getTime() + UNDO_DAYS * 86_400_000) : null,
				undone_at: null,
			})
			.execute();
		if (undoable)
			await trx
				.insertInto("monti_activity_snapshot")
				.values(
					records.map((ref) => {
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
		const deliveryIds = await queueDeliveries(trx, engine.receivers, activityId, events);
		const versions = Object.fromEntries([...after].map(([key, state]) => [key, state?.version ?? null]));
		return { output, activityId, versions, deliveryIds };
	});
}
