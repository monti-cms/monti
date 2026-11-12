import type { Kysely, Transaction } from "kysely";
import type { Database } from "../db/schema";
import { ForbiddenError } from "../errors";
import { sameJson } from "../json";
import { leaveNoFileInAGoneFolder, rewriteUses } from "../media/uses";
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
		const now = current.get(recordKey(ref));
		const unchanged = (now?.version ?? null) === snapshot.after_version;
		// A record the write named and left as it was (a save that names a value as it is saved) has nothing to put back: writing the same
		// values again would only move its version, and turn another tab's next save of it into a conflict.
		if (unchanged && sameJson(now?.data ?? null, snapshot.before ?? null)) return;
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
	for (const { ref, before } of snapshots) await engine.recordKinds.get(ref.kind)?.restore?.(trx, ref.id, before);
	await rewriteUses(
		trx,
		engine.site.schema(),
		snapshots.map(({ ref }) => ref),
	);
	// After everything is back: a folder and its files come back together, in no particular order. A folder the undo removed may hold
	// files moved in since, which are in no snapshot.
	const folders = snapshots.filter(({ ref }) => ref.kind === "folder").map(({ ref }) => ref.id);
	const moved =
		folders.length === 0 ? [] : await trx.selectFrom("media").select("id").where("folder_id", "in", folders).execute();
	await leaveNoFileInAGoneFolder(trx, [
		...snapshots.filter(({ ref }) => ref.kind === "media").map(({ ref }) => ref.id),
		...moved.map(({ id }) => id),
	]);
	await trx.updateTable("monti_activity").set({ undone_at: engine.now() }).where("id", "=", activityId).execute();
	return plan;
}
