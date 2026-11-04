import type { Kysely, Transaction } from "kysely";
import type { Database } from "../db/schema";
import { ForbiddenError } from "../errors";
import { type RecordRef, recordKey } from "../operation";
import { type Engine, loadRecords } from "./execute";

export type UndoPlan = {
	/** Records still as the write left them; undo puts their snapshot back. */
	restore: RecordRef[];
	/** Records changed since the write; undo leaves them alone. */
	skip: RecordRef[];
};

/** Which records an undo would put back and which it would skip, refusing a write that cannot be undone. */
export async function planUndo(
	engine: Engine,
	db: Kysely<Database> | Transaction<Database>,
	activityId: string,
): Promise<UndoPlan & { snapshots: { ref: RecordRef; before: unknown | null }[] }> {
	const row = await db
		.selectFrom("monti_activity")
		.select(["undo_until", "undone_at"])
		.where("id", "=", activityId)
		.executeTakeFirst();
	if (!row?.undo_until) throw new ForbiddenError({ key: "errors.notUndoable" });
	if (row.undone_at) throw new ForbiddenError({ key: "errors.alreadyUndone" });
	if (row.undo_until < engine.now()) throw new ForbiddenError({ key: "errors.undoExpired" });

	const snapshots = await db
		.selectFrom("monti_activity_snapshot")
		.selectAll()
		.where("activity_id", "=", activityId)
		.execute();
	const refs = snapshots.map((snapshot) => ({ kind: snapshot.kind, id: snapshot.record_id }));
	const current = await loadRecords(engine, db, refs);
	const plan: UndoPlan & { snapshots: { ref: RecordRef; before: unknown | null }[] } = {
		restore: [],
		skip: [],
		snapshots: [],
	};
	snapshots.forEach((snapshot, index) => {
		const ref = refs[index];
		const unchanged = (current.get(recordKey(ref))?.version ?? null) === snapshot.after_version;
		(unchanged ? plan.restore : plan.skip).push(ref);
		if (unchanged) plan.snapshots.push({ ref, before: snapshot.before });
	});
	return plan;
}

/** Puts back the records the write changed, except those changed since, and marks the write undone. */
export async function undo(
	engine: Engine,
	trx: Kysely<Database> | Transaction<Database>,
	activityId: string,
): Promise<UndoPlan> {
	const { snapshots, ...plan } = await planUndo(engine, trx, activityId);
	for (const { ref, before } of snapshots) await engine.recordKinds.get(ref.kind)?.restore(trx, ref.id, before);
	await trx.updateTable("monti_activity").set({ undone_at: engine.now() }).where("id", "=", activityId).execute();
	return plan;
}
