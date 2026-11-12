import type { Kysely, Transaction } from "kysely";
import type { Database } from "../db/schema";
import { followerPaths, publicPaths } from "../entries/paths";
import { ForbiddenError } from "../errors";
import { sameJson } from "../json";
import { leaveNoFileInAGoneFolder, rewriteUses } from "../media/uses";
import { type EmittedEvent, type RecordRef, recordKey } from "../operation";
import { type Engine, loadRecords } from "./execute";

type Db = Kysely<Database> | Transaction<Database>;

export type UndoPlan = {
	/** Records still as the write left them; undo puts their snapshot back. */
	restore: RecordRef[];
	/** Records changed since the write; undo leaves them alone. */
	skip: RecordRef[];
};

type Step = { activityId: string; snapshots: { ref: RecordRef; before: unknown | null }[] };

/** A plan as `applyUndo` follows it: the writes to undo, newest first, each with the snapshots it puts back. */
type UndoSteps = UndoPlan & { steps: Step[] };

/**
 * Which records an undo would put back and which it would skip. `line` is a line of the activity log: one write's id, or a proposal's id, whose
 * writes are undone together, newest first. A write that cannot be undone (a permanent delete, a structure change), is past its 30 days or is
 * already undone is left out; when none is left, it says why.
 *
 * A record is put back when nothing wrote it since: its version is the one the write left. Where a proposal wrote one record several times, the
 * newer write's snapshot brings back the version the older one left, so the older one is undone too; a write by anyone else in between breaks the
 * chain, and what is older stays.
 */
export async function planUndo(engine: Engine, db: Db, line: string): Promise<UndoSteps> {
	const rows = await db
		.selectFrom("monti_activity")
		.select(["id", "undo_until", "undone_at"])
		.where((eb) => eb.or([eb("id", "=", line), eb("proposal_id", "=", line)]))
		.orderBy("at", "desc")
		.orderBy("seq", "desc")
		.execute();
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
	const refs = snapshots.map((snapshot) => ({ kind: snapshot.kind, id: snapshot.record_id }));
	const current = await loadRecords(engine, db, refs);
	/** The version each record is back at, once the newer writes of the line are undone. */
	const backAt = new Map<string, number | null>();
	const plan: UndoSteps = { restore: [], skip: [], steps: [] };
	const seen = { restore: new Set<string>(), skip: new Set<string>() };
	for (const row of open) {
		const step: Step = { activityId: row.id, snapshots: [] };
		for (const snapshot of snapshots.filter((each) => each.activity_id === row.id)) {
			const ref = { kind: snapshot.kind, id: snapshot.record_id };
			const key = recordKey(ref);
			const version = backAt.has(key) ? (backAt.get(key) ?? null) : (current.get(key)?.version ?? null);
			const unchanged = version === snapshot.after_version;
			if (unchanged) {
				step.snapshots.push({ ref, before: snapshot.before });
				backAt.set(key, snapshot.before_version);
			}
			const list = unchanged ? "restore" : "skip";
			if (!seen[list].has(key)) {
				seen[list].add(key);
				plan[list].push(ref);
			}
		}
		plan.steps.push(step);
	}
	// A record an older write of the line could not put back is not also counted as put back by a newer one: it says "changed since" once.
	plan.restore = plan.restore.filter((ref) => !seen.skip.has(recordKey(ref)));
	return plan;
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
 * Undoes a line of the activity log, with the events of an undo that changes what the site shows (doc 13, T29): an entry back on the site or off
 * it, a published copy put back as it was before (its address, its date or its content), a file back in the library or out of it, or under the
 * name it had. An undo that only changes working copies emits nothing: no visitor sees a difference. `emit` gets each event with the newest write
 * the undo took back: the line its delivery shows on, since the undo has no line of its own.
 */
export async function undoWithEvents(
	engine: Engine,
	trx: Db,
	line: string,
	emit: (event: EmittedEvent, undone: string) => void,
): Promise<UndoPlan> {
	const { steps, ...plan } = await planUndo(engine, trx, line);
	const [newest] = steps;
	// What is really put back: a record one write of the line restores and an older one skips is put back all the same.
	const refs = [
		...new Map(steps.flatMap((step) => step.snapshots.map(({ ref }) => [recordKey(ref), ref] as const))).values(),
	];
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
	return plan;
}
