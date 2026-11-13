import type { Kysely, Transaction } from "kysely";
import type { Database } from "../db/schema";
import { followerPaths, publicPaths } from "../entries/paths";
import { CheckError, ForbiddenError } from "../errors";
import { sameJson } from "../json";
import { leaveNoFileInAGoneFolder, lockWithFiles, rewriteUses } from "../media/uses";
import { type EmittedEvent, placeEvents, type RecordRef, recordKey } from "../operation";
import { keepSeenTracked } from "../schema/apply";
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
	/**
	 * Records among `restore` the undo deletes for good: the writes created them, and taking a create back leaves nothing in the trash. An undo
	 * leaves no line of its own and cannot be undone, so nothing brings them back.
	 */
	removes: RecordRef[];
	/**
	 * Records among `restore` the undo puts in the trash again: a restore taken back. What points at them on the site loses them, as when a
	 * person throws them away by hand.
	 */
	trashes: RecordRef[];
};

/**
 * One write of a plan and the records it is taken back through. `same`: the record holds what the snapshot holds already (the write named it
 * and left it as it was, or wrote the same values again), so nothing of it is put back: writing the same values would only move its version,
 * and turn another tab's next save of it into a conflict. It is walked through all the same, as one that was put back.
 */
type Step = { activityId: string; snapshots: { ref: RecordRef; before: unknown | null; same: boolean }[] };

/**
 * A plan as it is carried out: the writes to undo, newest first, each with its snapshots; and the records the writes named of which nothing
 * is put back because they hold it already (`same`). Those are neither changed (`restore`) nor left alone for a later write (`skip`).
 */
type UndoSteps = UndoPlan & { same: RecordRef[]; steps: Step[] };

/**
 * What an undo takes back: a line of the activity log (its id is its first write's), every write applied from one proposal, however many lines it
 * made, or one write alone (a proposal's revert goes through its items one by one, each with its own result).
 */
export type UndoOf = { line: string } | { proposal: string } | { write: string };

/**
 * Which records an undo would change and which it would leave alone. The writes are taken newest first. A write that cannot be undone (a permanent
 * delete, a structure change), is past its 30 days or is already undone is left out; when none is left, it says why.
 *
 * A record is put back when nothing wrote it since: its version is the one the write left. Where several of the writes changed one record, the newer
 * write's snapshot brings back the version the older one left, so the older one is undone too; a write by anyone else in between breaks the chain:
 * the record goes back to that write, and what is older stays (`partly`). A record whose newest write is already written over is not touched at
 * all (`skip`).
 *
 * The preview, the refusal, what is carried out and what is answered are made the same way, by this function. They are not one reading: a
 * preview plans with no locks, and the undo plans again under them (`lock`), so a record written between the two is skipped by the undo though
 * the preview offered it. The undo's answer says what it did (`restore`, `skip`). Under `lock` nothing the plan read can change before it is
 * carried out.
 *
 * A version an earlier undo put back counts as the version it brought back: undoing a record's writes one line after another walks back through
 * them, each undo finding the record where the one before left it. Only a write that is no undo breaks the chain.
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
					: "write" in of
						? eb("id", "=", of.write)
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
	// With the files the records it puts back name, as they were: the undo comes for those once they are back (`rewriteUses`).
	if (options.lock) await lockWithFiles(db, refs, { willHold: snapshots.map((snapshot) => snapshot.before) });
	const current = await loadRecords(engine, db, refs);
	// What earlier undos put back: the version each left a record at stands for the version whose content it brought back.
	const putBack =
		refs.length === 0
			? []
			: await db
					.selectFrom("monti_activity_snapshot")
					.select(["kind", "record_id", "before_version", "restored_version"])
					.where("restored_version", "is not", null)
					.where(
						"record_id",
						"in",
						refs.map((ref) => ref.id),
					)
					.execute();
	const standsFor = new Map(
		putBack.map((row) => [
			`${recordKey({ kind: row.kind, id: row.record_id })}@${row.restored_version}`,
			row.before_version,
		]),
	);
	/** The version whose content a record holds: itself, or what the undos that made it brought back. */
	const contentOf = (key: string, version: number | null) => {
		let at = version;
		for (let hops = 0; at !== null && standsFor.has(`${key}@${at}`) && hops < 1000; hops++)
			at = standsFor.get(`${key}@${at}`) ?? null;
		return at;
	};
	/** The version each record is back at, once the newer writes are undone; absent while none of them touched it. */
	const backAt = new Map<string, number | null>();
	/** Records an older write could not take back after a newer one did. */
	const broken = new Set<string>();
	/** What each record holds once the newer writes are undone: what the last of them puts back; absent while none touched it. */
	const holds = new Map<string, unknown | null>();
	/** Records of which something is put back. */
	const changes = new Set<string>();
	const steps: Step[] = [];
	for (const row of open) {
		const step: Step = { activityId: row.id, snapshots: [] };
		for (const snapshot of snapshotsOf(row.id)) {
			const ref = { kind: snapshot.kind, id: snapshot.record_id };
			const key = recordKey(ref);
			// Once the chain is broken for a record, nothing older of it is taken back either: the write in between stays, with what was under it.
			if (broken.has(key)) continue;
			const version = backAt.has(key) ? (backAt.get(key) ?? null) : (current.get(key)?.version ?? null);
			if (version === snapshot.after_version || contentOf(key, version) === snapshot.after_version) {
				const held = holds.has(key) ? holds.get(key) : (current.get(key)?.data ?? null);
				const same = sameJson(held ?? null, snapshot.before ?? null);
				step.snapshots.push({ ref, before: snapshot.before, same });
				if (!same) changes.add(key);
				backAt.set(key, snapshot.before_version);
				holds.set(key, snapshot.before ?? null);
			} else broken.add(key);
		}
		// A write none of whose records can be walked back through is no step: it is not marked undone, and no event attaches to it. One
		// whose records all hold what they held before it is a step: there is nothing to put back, and it is undone.
		if (step.snapshots.length > 0) steps.push(step);
	}
	// Where each record ends: at the snapshot the oldest of its undone writes holds (the steps are newest first, so the last one put back wins).
	const endsAt = new Map<string, unknown | null>();
	for (const step of steps) for (const { ref, before } of step.snapshots) endsAt.set(recordKey(ref), before);
	const inTrash = (ref: RecordRef, data: unknown) =>
		data !== null && data !== undefined && (engine.recordKinds.get(ref.kind)?.inTrash?.(data) ?? false);
	const restore = refs.filter((ref) => changes.has(recordKey(ref)));
	return {
		restore,
		same: refs.filter((ref) => backAt.has(recordKey(ref)) && !changes.has(recordKey(ref))),
		skip: refs.filter((ref) => !backAt.has(recordKey(ref))),
		partly: refs.filter((ref) => changes.has(recordKey(ref)) && broken.has(recordKey(ref))),
		removes: restore.filter((ref) => endsAt.get(recordKey(ref)) === null),
		trashes: restore.filter(
			(ref) => inTrash(ref, endsAt.get(recordKey(ref))) && !inTrash(ref, current.get(recordKey(ref))?.data),
		),
		steps,
	};
}

/** Puts back the records of a plan, newest write first, and marks its writes undone. */
async function applyUndo(engine: Engine, trx: Db, plan: UndoSteps): Promise<void> {
	const restored: RecordRef[] = [];
	for (const step of plan.steps) {
		for (const { ref, before, same } of step.snapshots) {
			if (same) continue;
			// A kind with no `restore` is versioned only (the schema), and no write keeps a snapshot of it.
			await engine.recordKinds.get(ref.kind)?.restore?.(trx, ref.id, before);
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
	// What an entry saw back then may be of a field that has since left the schema: that mark comes off, and the entry moves on a version with
	// it. Before the versions are read below, so the version the undo records, and the one its events carry, is where the entry ends.
	await keepSeenTracked(trx, engine.site.schema());
	// Where each record stands now, on the snapshot that was put back last (the oldest write's): the next undo of an older write reads this
	// version as the one that write left. Also for a record that held it already and was not written (`same`): the version it stands at
	// holds what the snapshot holds, and an older write is walked back through it.
	const last = new Map<string, { activityId: string; ref: RecordRef }>();
	for (const step of plan.steps)
		for (const { ref } of step.snapshots) last.set(recordKey(ref), { activityId: step.activityId, ref });
	const now = await loadRecords(
		engine,
		trx,
		[...last.values()].map(({ ref }) => ref),
	);
	for (const [key, { activityId, ref }] of last) {
		const version = now.get(key)?.version ?? null;
		if (version === null) continue;
		await trx
			.updateTable("monti_activity_snapshot")
			.set({ restored_version: version })
			.where("activity_id", "=", activityId)
			.where("kind", "=", ref.kind)
			.where("record_id", "=", ref.id)
			.execute();
	}
	if (plan.steps.length > 0)
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

/**
 * What receivers know of entries and files now: each entry's working copy (where it is, its version, whether it is in the trash), its published
 * copy while it is out of the trash, and whether a file is in the library.
 */
async function shownNow(db: Db, refs: RecordRef[]) {
	const ids = (kind: string) => refs.filter((ref) => ref.kind === kind).map((ref) => ref.id);
	const entries = ids("entry");
	const media = ids("media");
	const working =
		entries.length === 0
			? []
			: await db
					.selectFrom("entries")
					.select(["id", "collection", "locale", "version", "trashed_at"])
					.where("id", "in", entries)
					.execute();
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
		working: new Map(working.map((entry) => [entry.id, entry])),
		entries: new Map(copies.map((copy) => [copy.entry_id, copy])),
		files: new Map(files.map((file) => [file.id, file.name])),
	};
}

/**
 * Undoes writes of the activity log (a line, a proposal's, or one write), with the events of what it changes (doc 13, T29): an entry
 * back on the site or off it, a published copy put back as it was before (its address, its date or its content), a file back in the library or out
 * of it, or under the name it had; and what a receiver with its own copy of the entries must hear though no visitor sees it: an entry gone again,
 * in the trash again or out of it, or back at what it held before a save. `emit` gets each event with
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
): Promise<UndoPlan & { undone: string[]; put: { write: string; back: RecordRef[]; same: RecordRef[] }[] }> {
	const { steps, same, ...plan } = await planUndo(engine, trx, of, { lock: true });
	// Every record of the writes was written again since: nothing would change, so nothing is marked undone either.
	if (plan.restore.length === 0 && plan.skip.length > 0) throw new CheckError({ key: "activity.allChanged" });
	const [newest] = steps;
	const refs = plan.restore;
	const before = await shownNow(trx, refs);
	await applyUndo(engine, trx, { ...plan, same, steps });
	const after = await shownNow(trx, refs);
	const schema = engine.site.schema();
	const say = (event: EmittedEvent) => {
		if (newest) emit(event, newest.activityId);
	};
	/** The entries whose change on the site is told: that event carries the news, and no save is said beside it. */
	const told = new Set<string>();
	for (const ref of refs.filter((each) => each.kind === "entry")) {
		const [was, is] = [before.entries.get(ref.id), after.entries.get(ref.id)];
		if (!was && !is) continue;
		// The same address, date and content: no visitor sees a difference.
		if (was && is && sameJson(was, is)) continue;
		const shown = is ?? was;
		if (!shown) continue;
		told.add(ref.id);
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
	// What a receiver that keeps its own copy of the entries has to hear, though no visitor sees a difference (a search index): an entry that is
	// gone again (a create undone), in the trash again or out of it, or back at what it held before a save.
	const placed = (ids: string[], from: typeof before) =>
		ids.flatMap((id) => {
			const entry = from.working.get(id);
			return entry ? [{ id, collection: entry.collection, locale: entry.locale }] : [];
		});
	const entryIds = refs.filter((each) => each.kind === "entry").map((each) => each.id);
	const deleted = entryIds.filter((id) => before.working.has(id) && !after.working.has(id));
	const trashed = entryIds.filter(
		(id) => before.working.get(id)?.trashed_at === null && (after.working.get(id)?.trashed_at ?? null) !== null,
	);
	const restored = entryIds.filter(
		(id) => (before.working.get(id)?.trashed_at ?? null) !== null && after.working.get(id)?.trashed_at === null,
	);
	const moved = new Set([...deleted, ...trashed, ...restored]);
	for (const event of [
		...placeEvents("entry.purged", placed(deleted, before)),
		...placeEvents("entry.trashed", placed(trashed, after)),
		...placeEvents("entry.restored", placed(restored, after)),
	])
		say(event);
	for (const id of entryIds) {
		const [was, is] = [before.working.get(id), after.working.get(id)];
		// Its content went back and it is neither in the trash nor just out of it: a save, as the receivers heard the one that is undone.
		if (!is || moved.has(id) || told.has(id) || is.trashed_at !== null || was?.version === is.version) continue;
		say({ type: "entry.saved", ids: [id], collection: is.collection, locale: is.locale, version: is.version });
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
	return {
		...plan,
		undone: steps.map((step) => step.activityId),
		// Write by write, what went back and what held it already: a proposal's item is judged by the records of its own write.
		put: steps.map((step) => ({
			write: step.activityId,
			back: step.snapshots.filter((snapshot) => !snapshot.same).map((snapshot) => snapshot.ref),
			same: step.snapshots.filter((snapshot) => snapshot.same).map((snapshot) => snapshot.ref),
		})),
	};
}
