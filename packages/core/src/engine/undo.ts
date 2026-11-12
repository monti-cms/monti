import type { Kysely, Transaction } from "kysely";
import type { Database } from "../db/schema";
import { followerPaths, publicPaths } from "../entries/paths";
import { ForbiddenError } from "../errors";
import { sameJson } from "../json";
import { leaveNoFileInAGoneFolder, rewriteUses } from "../media/uses";
import { type MontiEvent, type RecordRef, recordKey } from "../operation";
import { type Engine, loadRecords } from "./execute";

export type UndoPlan = {
	/** Records still as the write left them; undo puts their snapshot back. */
	restore: RecordRef[];
	/** Records changed since the write; undo leaves them alone. */
	skip: RecordRef[];
};

/**
 * A record that is not at the version the write left, and still holds what the write left: `left` is that version, `current` the one it has now.
 * Putting a proposal back says so of a record its own earlier step just put back (the step gave it a new version).
 */
export type OwnStep = (ref: RecordRef, left: number | null, current: number | null) => boolean;

/** Which records an undo would put back and which it would skip, refusing a write that cannot be undone. */
export async function planUndo(
	engine: Engine,
	db: Kysely<Database> | Transaction<Database>,
	activityId: string,
	ownStep?: OwnStep,
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
		const now = current.get(recordKey(ref))?.version ?? null;
		const unchanged = now === snapshot.after_version || ownStep?.(ref, snapshot.after_version, now) === true;
		(unchanged ? plan.restore : plan.skip).push(ref);
		if (unchanged) plan.snapshots.push({ ref, before: snapshot.before });
	});
	return plan;
}

/** Puts back the records the write changed, except those changed since, and marks the write undone. */
async function undo(
	engine: Engine,
	trx: Kysely<Database> | Transaction<Database>,
	activityId: string,
	ownStep?: OwnStep,
): Promise<UndoPlan> {
	const { snapshots, ...plan } = await planUndo(engine, trx, activityId, ownStep);
	for (const { ref, before } of snapshots) await engine.recordKinds.get(ref.kind)?.restore(trx, ref.id, before);
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

type Db = Kysely<Database> | Transaction<Database>;

/** What the site shows of entries and files now: an entry's published copy while it is out of the trash, and whether a file is in the library. */
async function shownNow(db: Db, refs: RecordRef[]) {
	const ids = (kind: string) => refs.filter((ref) => ref.kind === kind).map((ref) => ref.id);
	const entries = ids("entry");
	const media = ids("media");
	const copies =
		entries.length === 0
			? []
			: await db
					.selectFrom("entry_published as p")
					.innerJoin("entries as e", "e.id", "p.entry_id")
					.select([
						"p.entry_id",
						"p.collection",
						"p.locale",
						"p.slug",
						"p.published_at",
						// What a page draws: a live item's values change with no new version and no new date (`relations.edit`).
						"p.title",
						"p.values",
						"p.doc",
					])
					.where("p.entry_id", "in", entries)
					.where("e.trashed_at", "is", null)
					.execute();
	// A file in the library, with the name a page shows for it (a download's label).
	const files =
		media.length === 0
			? []
			: await db
					.selectFrom("media")
					.select(["id", "name"])
					.where("id", "in", media)
					.where("trashed_at", "is", null)
					.execute();
	return {
		entries: new Map(copies.map((copy) => [copy.entry_id, copy])),
		files: new Map(files.map((file) => [file.id, file.name])),
	};
}

/**
 * The events of an undo that changes what the site shows (doc 13, T29): an entry back on the site or off it, a published copy put back as it was
 * before (its address, its date or its content), a file back in the library or out of it, or under the name it had. An undo that only
 * changes working copies emits nothing: no visitor sees a difference.
 */
export async function undoWithEvents(
	engine: Engine,
	trx: Db,
	activityId: string,
	emit: (event: MontiEvent) => void,
	ownStep?: OwnStep,
): Promise<UndoPlan> {
	const refs = (await planUndo(engine, trx, activityId, ownStep)).restore;
	const before = await shownNow(trx, refs);
	const plan = await undo(engine, trx, activityId, ownStep);
	const after = await shownNow(trx, refs);
	const schema = engine.site.schema();
	for (const ref of refs.filter((each) => each.kind === "entry")) {
		const [was, is] = [before.entries.get(ref.id), after.entries.get(ref.id)];
		if (!was && !is) continue;
		// The same address, date and content: no visitor sees a difference.
		if (was && is && sameJson(was, is)) continue;
		const shown = is ?? was;
		if (!shown) continue;
		emit({
			type: is ? "entry.published" : "entry.unpublished",
			ids: [ref.id],
			collection: shown.collection,
			locale: shown.locale,
			paths: [
				...publicPaths(schema, shown.collection, shown.locale, [is?.slug, was?.slug]),
				// The translations that follow it show the change too.
				...(await followerPaths(trx, schema, { id: ref.id, collection: shown.collection, locale: shown.locale })),
			],
		});
	}
	const files = refs.filter((each) => each.kind === "media").map((each) => each.id);
	const back = files.filter((id) => !before.files.has(id) && after.files.has(id));
	const gone = files.filter((id) => before.files.has(id) && !after.files.has(id));
	// In the library before and after, under another name: a rename undone. (A replacement is a person's write and is not undone.)
	const renamed = files.filter((id) => {
		const [was, is] = [before.files.get(id), after.files.get(id)];
		return was !== undefined && is !== undefined && was !== is;
	});
	if (back.length > 0) emit({ type: "media.restored", ids: back });
	if (gone.length > 0) emit({ type: "media.trashed", ids: gone });
	if (renamed.length > 0) emit({ type: "media.renamed", ids: renamed });
	return plan;
}
