import type { Kysely, Transaction } from "kysely";
import type { Database } from "../db/schema";
import { followerPaths, publicPaths } from "../entries/paths";
import { CheckError, ForbiddenError } from "../errors";
import { sameJson } from "../json";
import { leaveNoFileInAGoneFolder, rewriteUses } from "../media/uses";
import { type EmittedEvent, type RecordRef, recordKey } from "../operation";
import { lockRecords } from "../records";
import { type Engine, loadRecords } from "./execute";

type Db = Kysely<Database> | Transaction<Database>;

export type UndoPlan = {
	/** Records the undo changes: each goes back to what it was before the newest of the writes on it that can still be taken back. */
	restore: RecordRef[];
	/** Records the undo leaves alone: something wrote them since, and nothing of the line's writes on them can be taken back. */
	skip: RecordRef[];
	/**
	 * Records among `restore` that go back only part of the way: the newer of the line's writes on them are undone, an older one is not, because
	 * someone else wrote the record in between and that write stays.
	 */
	partly: RecordRef[];
};

type Step = { activityId: string; snapshots: { ref: RecordRef; before: unknown | null }[] };

/** A plan as it is carried out: the writes to undo, newest first, each with the snapshots it puts back. */
type UndoSteps = UndoPlan & { steps: Step[] };

/**
 * What an undo takes back: a line of the activity log (a write's id, or a line's, which is its first write's id), or every write applied from one
 * proposal, however many lines it made.
 */
export type UndoOf = { line: string } | { proposal: string };

/**
 * Which records an undo would change and which it would leave alone. The writes are taken newest first. A write that cannot be undone (a permanent
 * delete, a structure change), is past its 30 days or is already undone is left out; when none is left, it says why.
 *
 * A record is put back when nothing wrote it since: its version is the one the write left. Where several of the writes changed one record, the newer
 * write's snapshot brings back the version the older one left, so the older one is undone too; a write by anyone else in between breaks the chain:
 * the record goes back to that write, and what is older stays (`partly`). A record whose newest write is already written over is not touched at
 * all (`skip`).
 *
 * The preview, the refusal, what is carried out and what is answered are this one plan. With `lock` it is made under the locks an undo needs (see
 * `lockUndo`), so nothing it read can change before it is carried out.
 */
export async function planUndo(
	engine: Engine,
	db: Db,
	of: UndoOf,
	options: { lock?: boolean } = {},
): Promise<UndoSteps> {
	const select = () =>
		db
			.selectFrom("monti_activity")
			.select(["id", "undo_until", "undone_at"])
			.where((eb) =>
				"proposal" in of
					? eb("proposal_id", "=", of.proposal)
					: eb.or([eb("id", "=", of.line), eb("line", "=", of.line)]),
			)
			.orderBy("seq", "desc");
	// Two undos of the same writes take them one after the other: the second finds them undone.
	const rows = options.lock ? await select().forUpdate().execute() : await select().execute();
	const now = engine.now();
	const open = rows.filter((row) => row.undo_until !== null && row.undone_at === null && row.undo_until >= now);
	if (open.length === 0) {
		if (rows.some((row) => row.undone_at !== null)) throw new ForbiddenError({ key: "errors.alreadyUndone" });
		if (rows.some((row) => row.undo_until !== null)) throw new ForbiddenError({ key: "errors.undoExpired" });
		throw new ForbiddenError({ key: "errors.notUndoable" });
	}

	const snapshots = await db
		.selectFrom("monti_activity_snapshot")
		.selectAll()
		.where(
			"activity_id",
			"in",
			open.map((row) => row.id),
		)
		.execute();
	/** A write's snapshots, in one order every time. */
	const snapshotsOf = (activityId: string) =>
		snapshots
			.filter((each) => each.activity_id === activityId)
			.sort((a, b) => a.kind.localeCompare(b.kind) || a.record_id.localeCompare(b.record_id));
	// The records, newest write first: the order the plan answers them in.
	const refs = [
		...new Map(
			open.flatMap((row) =>
				snapshotsOf(row.id).map((snapshot) => {
					const ref = { kind: snapshot.kind, id: snapshot.record_id };
					return [recordKey(ref), ref] as const;
				}),
			),
		).values(),
	];
	// The locks every write takes on the records it touches (`runWrite`): a save that is under way finishes first and is seen here, and one that
	// starts now waits until the undo is done. Without them an undo could read a version, lose the race, and put its snapshot over the save.
	if (options.lock) await lockRecords(db, refs);
	const current = await loadRecords(engine, db, refs);
	/** The version each record is back at, once the newer writes are undone; absent while none of them touched it. */
	const backAt = new Map<string, number | null>();
	/** Records an older write could not take back after a newer one did. */
	const broken = new Set<string>();
	const steps: Step[] = [];
	for (const row of open) {
		const step: Step = { activityId: row.id, snapshots: [] };
		for (const snapshot of snapshotsOf(row.id)) {
			const ref = { kind: snapshot.kind, id: snapshot.record_id };
			const key = recordKey(ref);
			// Once the chain is broken for a record, nothing older of it is taken back either: the write in between stays, with what was under it.
			if (broken.has(key)) continue;
			const version = backAt.has(key) ? (backAt.get(key) ?? null) : (current.get(key)?.version ?? null);
			if (version === snapshot.after_version) {
				step.snapshots.push({ ref, before: snapshot.before });
				backAt.set(key, snapshot.before_version);
			} else broken.add(key);
		}
		steps.push(step);
	}
	return {
		restore: refs.filter((ref) => backAt.has(recordKey(ref))),
		skip: refs.filter((ref) => !backAt.has(recordKey(ref))),
		partly: refs.filter((ref) => backAt.has(recordKey(ref)) && broken.has(recordKey(ref))),
		steps,
	};
}

/** Puts back the records of a plan, newest write first, and marks its writes undone. */
async function applyUndo(engine: Engine, trx: Db, plan: UndoSteps): Promise<void> {
	const restored: RecordRef[] = [];
	for (const step of plan.steps) {
		for (const { ref, before } of step.snapshots) {
			await engine.recordKinds.get(ref.kind)?.restore(trx, ref.id, before);
			restored.push(ref);
		}
	}
	const refs = [...new Map(restored.map((ref) => [recordKey(ref), ref])).values()];
	await rewriteUses(trx, engine.site.schema(), refs);
	// After everything is back: a folder and its files come back together, in no particular order. A folder the undo removed may hold
	// files moved in since, which are in no snapshot.
	const folders = refs.filter((ref) => ref.kind === "folder").map((ref) => ref.id);
	const moved =
		folders.length === 0 ? [] : await trx.selectFrom("media").select("id").where("folder_id", "in", folders).execute();
	await leaveNoFileInAGoneFolder(trx, [
		...refs.filter((ref) => ref.kind === "media").map((ref) => ref.id),
		...moved.map(({ id }) => id),
	]);
	await trx
		.updateTable("monti_activity")
		.set({ undone_at: engine.now() })
		.where(
			"id",
			"in",
			plan.steps.map((step) => step.activityId),
		)
		.execute();
}

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
 * Undoes writes of the activity log (a line, or a proposal's), with the events of an undo that changes what the site shows (doc 13, T29): an entry
 * back on the site or off it, a published copy put back as it was before (its address, its date or its content), a file back in the library or out
 * of it, or under the name it had. An undo that only changes working copies emits nothing: no visitor sees a difference. `emit` gets each event with
 * the newest write the undo took back: the line its delivery shows on, since the undo has no line of its own.
 *
 * This is the one way writes are taken back: the log's undo and a proposal's revert both come here, so the locks, the plan and the events are the
 * same for both. It runs in the caller's transaction, under the undo's locks; with nothing left to put back it is refused (`activity.allChanged`)
 * and nothing is marked undone.
 */
export async function undoWithEvents(
	engine: Engine,
	trx: Db,
	of: UndoOf,
	emit: (event: EmittedEvent, undone: string) => void,
): Promise<UndoPlan & { undone: string[] }> {
	const { steps, ...plan } = await planUndo(engine, trx, of, { lock: true });
	// Every record of the writes was written again since: nothing would change, so nothing is marked undone either.
	if (plan.restore.length === 0 && plan.skip.length > 0) throw new CheckError({ key: "activity.allChanged" });
	const [newest] = steps;
	const refs = plan.restore;
	const before = await shownNow(trx, refs);
	await applyUndo(engine, trx, { ...plan, steps });
	const after = await shownNow(trx, refs);
	const schema = engine.site.schema();
	const say = (event: EmittedEvent) => {
		if (newest) emit(event, newest.activityId);
	};
	for (const ref of refs.filter((each) => each.kind === "entry")) {
		const [was, is] = [before.entries.get(ref.id), after.entries.get(ref.id)];
		if (!was && !is) continue;
		// The same address, date and content: no visitor sees a difference.
		if (was && is && sameJson(was, is)) continue;
		const shown = is ?? was;
		if (!shown) continue;
		say({
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
	if (back.length > 0) say({ type: "media.restored", ids: back });
	if (gone.length > 0) say({ type: "media.trashed", ids: gone });
	if (renamed.length > 0) say({ type: "media.renamed", ids: renamed });
	return { ...plan, undone: steps.map((step) => step.activityId) };
}
