import type { Kysely, Transaction } from "kysely";
import { z } from "zod";
import { oneOrMany } from "../activity/words";
import type { Database, TrashedBy } from "../db/schema";
import { pathKept, publicPath } from "../entries/paths";
import { CheckError } from "../errors";
import { freeName, lockFolderScope, mediaRemoval, subtree } from "../folders/operations";
import { usedOf } from "../media/uses";
import {
	type Actor,
	defineOperation,
	type LoggedRecord,
	type OperationContext,
	type Preview,
	type RecordRef,
} from "../operation";
import { lockRecords } from "../records";
import { listTrash, TrashQuery, trashedEntry, trashRowCount } from "./list";
import { everyTrashRow, foldersUnder, placeEvents, purgeRows, sweepLooseFiles, type TrashRef } from "./purge";

type Db = Kysely<Database> | Transaction<Database>;

const Row = z.object({ kind: z.enum(["entry", "folder", "media"]), id: z.string() });
const Rows = z.object({ rows: z.array(Row).min(1) });

const ref =
	(kind: TrashRef["kind"]) =>
	(id: string): RecordRef => ({ kind, id });
const idsOf = (rows: TrashRef[], kind: TrashRef["kind"]) =>
	rows.filter((row) => row.kind === kind).map((row) => row.id);
const actorName = (actor: Actor): TrashedBy => (typeof actor === "string" ? actor : "plugin");
const UNKNOWN = { entry: "entries.unknown", folder: "folders.unknown", media: "media.unknown" } as const;

type Going = {
	id: string;
	collection: string;
	locale: string;
	group: string;
	/** Every language of its entry goes: nothing of it is left for those who point at it. */
	whole: boolean;
};

/**
 * The entries that go to the trash when these do (doc 11): a source-language entry takes its translations, and an item every language it has; a translation goes alone
 * and its source stays. `stamped` are languages of the same entries already in the trash: they take the day of this move, so an entry in the trash is one row with
 * one day to go.
 */
async function entriesGoing(ctx: OperationContext, seeds: string[]): Promise<{ going: Going[]; stamped: string[] }> {
	if (seeds.length === 0) return { going: [], stamped: [] };
	const schema = ctx.site.schema();
	const columns = ["id", "collection", "locale", "translation_group", "trashed_at"] as const;
	const given = await ctx.db
		.selectFrom("entries")
		.select(columns)
		.where("id", "in", seeds)
		.where("trashed_at", "is", null)
		.execute();
	const groups = [...new Set(given.map((row) => row.translation_group))];
	const members =
		groups.length === 0
			? []
			: await ctx.db.selectFrom("entries").select(columns).where("translation_group", "in", groups).execute();
	const whole = new Set(
		given
			.filter((row) => row.locale === schema.locales.source || schema.collections[row.collection]?.kind === "item")
			.map((row) => row.translation_group),
	);
	const seeded = new Set(given.map((row) => row.id));
	return {
		going: members
			.filter((row) => row.trashed_at === null && (seeded.has(row.id) || whole.has(row.translation_group)))
			.map((row) => ({
				id: row.id,
				collection: row.collection,
				locale: row.locale,
				group: row.translation_group,
				whole: whole.has(row.translation_group),
			})),
		stamped: members.filter((row) => row.trashed_at !== null).map((row) => row.id),
	};
}

type MovePlan = {
	entries: Going[];
	/** Entries already in the trash that take this move's day (see `entriesGoing`). */
	stamped: string[];
	folders: string[];
	/** Files that go. */
	media: string[];
	/** Files in use, which stay, with how many use each (doc 09). */
	kept: Map<string, number>;
	/** Every file looked at: the engine locks them, so a save that starts using one waits (09-4). */
	files: string[];
};

/**
 * What putting these rows in the trash moves: entries with what goes with them, a collection's folder with its subfolders and their entries, a media folder with the
 * files nobody uses (a file in use stays, and so do the folders that hold it).
 */
async function planMove(ctx: OperationContext, rows: TrashRef[], lock = false): Promise<MovePlan> {
	const { db } = ctx;
	const folders = new Set<string>();
	const media = new Set<string>();
	const files = new Set<string>();
	const kept = new Map<string, number>();
	const seeds = new Set(idsOf(rows, "entry"));
	for (const id of idsOf(rows, "folder")) {
		const folder = await db
			.selectFrom("folders")
			.select(["collection", "trashed_at"])
			.where("id", "=", id)
			.executeTakeFirst();
		if (!folder || folder.trashed_at) continue;
		if (folder.collection === null) {
			// The folders first: whatever moves in waits, so the files listed here, and snapshotted for the undo, are all there are (09-4).
			if (lock) await lockRecords(db, (await subtree(db, id)).map(ref("folder")));
			const removal = await mediaRemoval(db, id);
			for (const each of removal.gone) folders.add(each);
			for (const each of removal.files) files.add(each);
			for (const each of removal.moved) media.add(each);
			for (const [file, uses] of removal.used) kept.set(file, uses);
			continue;
		}
		// The folders first, as the library's: an entry on its way in waits (`entries.moveToFolder` takes the folder too), so the entries listed
		// here, and snapshotted for the undo, are all there are. Read again once they are held: a move that came first has landed.
		if (lock) await lockRecords(db, (await subtree(db, id)).map(ref("folder")));
		const inside = await subtree(db, id);
		for (const each of inside) folders.add(each);
		const held = await db
			.selectFrom("entries")
			.select("id")
			.where("folder_id", "in", inside)
			.where("trashed_at", "is", null)
			.execute();
		for (const row of held) seeds.add(row.id);
	}
	const asked = idsOf(rows, "media");
	const used = await usedOf(db, asked);
	for (const id of asked) {
		files.add(id);
		const uses = used.get(id);
		if (uses === undefined) media.add(id);
		else kept.set(id, uses);
	}
	const { going, stamped } = await entriesGoing(ctx, [...seeds]);
	return {
		entries: going,
		stamped,
		folders: [...folders],
		media: [...media],
		kept,
		files: [...files],
	};
}

/** What `trash.checkMove` answers: what a screen asks about before it puts rows in the trash (doc 11, principle 2). */
export type TrashEffects = {
	/** Entries that go: the ones asked for, the translations that go with a source and what the folders hold. */
	entries: number;
	/** Published documents that leave the site, a source with its translations counted once. */
	unpublished: number;
	/** Languages of the translations that go with their source. */
	translations: string[];
	/** Published documents that point at something among these and lose it on the site (doc 08). */
	pointing: number;
	/** Files in use, which stay. */
	kept: number;
};

async function effectsOf(ctx: OperationContext, plan: MovePlan): Promise<TrashEffects> {
	const schema = ctx.site.schema();
	const isDocument = (collection: string) => schema.collections[collection]?.kind === "document";
	const ids = plan.entries.map((entry) => entry.id);
	const published =
		ids.length === 0
			? new Set<string>()
			: new Set(
					(await ctx.db.selectFrom("entry_published").select("entry_id").where("entry_id", "in", ids).execute()).map(
						(row) => row.entry_id,
					),
				);
	const documents = plan.entries.filter((entry) => isDocument(entry.collection));
	// An entry leaves the site for those who point at it only when every language of it goes.
	const groups = [...new Set(plan.entries.filter((entry) => entry.whole).map((entry) => entry.group))];
	const pointing =
		groups.length === 0
			? []
			: await ctx.db
					.selectFrom("entry_links as l")
					.innerJoin("entries as e", "e.translation_group", "l.from_group")
					.innerJoin("entry_published as p", "p.entry_id", "e.id")
					.select(["l.from_group", "e.collection"])
					.distinct()
					.where("l.to_group", "in", groups)
					.where("l.from_group", "not in", groups)
					.where("e.trashed_at", "is", null)
					.execute();
	return {
		entries: ids.length,
		unpublished: new Set(documents.filter((entry) => published.has(entry.id)).map((entry) => entry.group)).size,
		translations: [
			...new Set(
				documents.filter((entry) => entry.whole && entry.locale !== schema.locales.source).map((entry) => entry.locale),
			),
		].sort(),
		pointing: new Set(pointing.filter((row) => isDocument(row.collection)).map((row) => row.from_group)).size,
		kept: plan.kept.size,
	};
}

/** What `trash.move` did. */
export type TrashMoved = {
	/** Rows asked for that went. */
	rows: number;
	entries: number;
	/** Published documents it took off the site. */
	unpublished: number;
	folders: number;
	/** Files that went, and files that stayed because something uses them. */
	moved: string[];
	kept: string[];
};

type RestoreEntry = {
	id: string;
	collection: string;
	locale: string;
	group: string;
	title: string;
	slug: string;
	status: string;
	folderId: string | null;
	version: number;
};
type RestorePlan = {
	entries: RestoreEntry[];
	/** Folders that come back, parents before children: the ones asked for with what is under them (`asked`), and the folders above anything that comes back. */
	folders: { id: string; asked: boolean }[];
	media: { id: string; folderId: string | null }[];
	/** Every folder there is, to find where things sat. */
	boxes: Map<
		string,
		{ id: string; parent_id: string | null; collection: string | null; name: string; trashed_at: Date | null }
	>;
};

/**
 * What restoring these rows brings back (doc 11, restoring): an entry with every language of it that is in the trash; a folder with everything under it; and above
 * anything that comes back, the folders it sat in, when they are in the trash too.
 */
async function planRestore(ctx: OperationContext, rows: TrashRef[]): Promise<RestorePlan> {
	const { db } = ctx;
	const boxes: RestorePlan["boxes"] = new Map(
		(await db.selectFrom("folders").select(["id", "parent_id", "collection", "name", "trashed_at"]).execute()).map(
			(row) => [row.id, row],
		),
	);
	const folders = new Map<string, boolean>();
	for (const id of idsOf(rows, "folder"))
		for (const each of await foldersUnder(db, id)) if (boxes.get(each)?.trashed_at) folders.set(each, true);
	const inside = [...folders.keys()];

	const entryIds = new Set(idsOf(rows, "entry"));
	const mediaIds = new Set(idsOf(rows, "media"));
	if (inside.length > 0) {
		const held = await db
			.selectFrom("entries")
			.select("id")
			.where("folder_id", "in", inside)
			.where("trashed_at", "is not", null)
			.execute();
		for (const row of held) entryIds.add(row.id);
		const files = await db
			.selectFrom("media")
			.select("id")
			.where("folder_id", "in", inside)
			.where("trashed_at", "is not", null)
			.execute();
		for (const row of files) mediaIds.add(row.id);
	}

	const columns = [
		"id",
		"collection",
		"locale",
		"translation_group as group",
		"title",
		"slug",
		"status",
		"folder_id as folderId",
		"version",
	] as const;
	// Every language of an entry that is in the trash comes back with it: the trash showed them as one row.
	const entries = new Map<string, RestoreEntry>();
	if (entryIds.size > 0)
		for (const row of await db
			.selectFrom("entries")
			.select(columns)
			.where("trashed_at", "is not", null)
			.where(
				"translation_group",
				"in",
				db
					.selectFrom("entries")
					.select("translation_group")
					.where("id", "in", [...entryIds])
					.where("trashed_at", "is not", null),
			)
			.execute())
			entries.set(row.id, row);
	const media =
		mediaIds.size === 0
			? []
			: await db
					.selectFrom("media")
					.select(["id", "folder_id as folderId"])
					.where("id", "in", [...mediaIds])
					.where("trashed_at", "is not", null)
					.execute();

	// The folders above what comes back, as far up as they are in the trash.
	const above = (id: string | null) => {
		for (let at = id === null ? undefined : boxes.get(id); at?.trashed_at; ) {
			if (!folders.has(at.id)) folders.set(at.id, false);
			at = at.parent_id === null ? undefined : boxes.get(at.parent_id);
		}
	};
	for (const entry of entries.values()) above(entry.folderId);
	for (const file of media) above(file.folderId);
	for (const id of [...folders.keys()]) above(boxes.get(id)?.parent_id ?? null);
	const depth = (id: string): number => {
		const parent = boxes.get(id)?.parent_id;
		return parent && boxes.has(parent) ? depth(parent) + 1 : 0;
	};
	return {
		entries: [...entries.values()],
		folders: [...folders].map(([id, asked]) => ({ id, asked })).sort((a, b) => depth(a.id) - depth(b.id)),
		media,
		boxes,
	};
}

/** What `trash.restore` did. */
export type TrashRestored = {
	/** Rows asked for that came back. */
	rows: number;
	/** The one entry asked for, to open it: `draft` when it came back as a draft (a document that was not archived). */
	entry: { id: string; collection: string; draft: boolean } | null;
	/** The folders that came back only to hold what did, by name. */
	folders: string[];
	/** Items whose address another had taken meanwhile: the address it had, and the one it has now. */
	renamed: { from: string; to: string }[];
};

/** The item's slug, or with `-2`, `-3` … the first that no live entry, published copy or kept path of its collection and language has. */
async function freeSlug(db: Db, entry: RestoreEntry): Promise<string> {
	for (let n = 1; ; n++) {
		const slug = n === 1 ? entry.slug : `${entry.slug}-${n}`;
		const live = await db
			.selectFrom("entries")
			.select("id")
			.where("collection", "=", entry.collection)
			.where("locale", "=", entry.locale)
			.where("slug", "=", slug)
			.where("trashed_at", "is", null)
			.where("id", "<>", entry.id)
			.executeTakeFirst();
		if (!live && !(await pathKept(db, entry.collection, entry.locale, slug))) return slug;
	}
}

async function inTrash(db: Db, rows: TrashRef[]): Promise<void> {
	const tables = { entry: "entries", folder: "folders", media: "media" } as const;
	for (const kind of ["entry", "folder", "media"] as const) {
		const ids = idsOf(rows, kind);
		if (ids.length === 0) continue;
		const found = await db
			.selectFrom(tables[kind])
			.select("id")
			.where("id", "in", ids)
			.where("trashed_at", "is not", null)
			.execute();
		const there = new Set(found.map((row) => row.id));
		if (ids.some((id) => !there.has(id))) throw new CheckError({ key: "trash.unknown" });
	}
}

/** The records of the rows a person asked for, for the log's first line: the folder, not everything in it. */
const askedRecords = (rows: TrashRef[], records: LoggedRecord[]) =>
	rows.flatMap((row) => records.find((record) => record.kind === row.kind && record.id === row.id) ?? []);

/** Tells the receivers of entries thrown away, brought back or deleted for good: one event for each collection and language. */
function emitByPlace(
	ctx: OperationContext,
	type: "entry.trashed" | "entry.restored" | "entry.purged",
	entries: { id: string; collection: string; locale: string }[],
) {
	for (const event of placeEvents(type, entries)) ctx.emit(event);
}

/** A file deleted for good leaves the storage only once its row's delete has committed (doc 11): after the write, on the database itself. */
async function sweepNow(_output: unknown, ctx: OperationContext): Promise<undefined> {
	await sweepLooseFiles(ctx.db as Kysely<Database>, ctx.site.storage, ctx.now());
}

export const trashOperations = [
	defineOperation({
		name: "trash.list",
		kind: "read",
		description:
			"The rows of the trash, newest first: entries (a source with the translations that went with it is one row), folders (one row; give `folder` to look inside) and media files, each with the days left before it is deleted for good. Filter by kind (collection names, or `media`) and search by words; a search looks inside thrown-away folders too.",
		input: TrashQuery,
		run: (input, ctx) => listTrash(ctx, input),
	}),
	defineOperation({
		name: "trash.get",
		kind: "read",
		description:
			"An entry in the trash: every language of it that is there, each with its title and address, and the entries whose relations point at it.",
		input: z.object({ id: z.string() }),
		run: (input, ctx) => trashedEntry(ctx, input.id),
	}),
	defineOperation({
		name: "trash.checkMove",
		kind: "read",
		description:
			"What putting these rows in the trash would do, without doing it: how many entries go, how many published documents leave the site, which translations go with their source, how many published documents point at them, and how many files stay because something uses them.",
		input: Rows,
		run: async (input, ctx) => effectsOf(ctx, await planMove(ctx, input.rows)),
	}),
	defineOperation({
		name: "trash.move",
		kind: "write",
		description:
			"Put entries, folders and media files in the trash. A source-language entry takes its translations; a translation goes alone. A folder goes with its subfolders and everything in them. Published entries go off the site. A media file in use stays where it is, and so does a folder that holds one. The trash can restore them for 30 days. Read the preview first, and propose it only when asked to.",
		input: Rows,
		async touches(input, ctx) {
			const plan = await planMove(ctx, input.rows, true);
			return [
				...plan.entries.map((entry) => ref("entry")(entry.id)),
				...plan.stamped.map(ref("entry")),
				...plan.folders.map(ref("folder")),
				...plan.files.map(ref("media")),
			];
		},
		async check(input, ctx) {
			const live = { entry: "entries", folder: "folders", media: "media" } as const;
			for (const row of input.rows) {
				const found = await ctx.db
					.selectFrom(live[row.kind])
					.select("id")
					.where("id", "=", row.id)
					.where("trashed_at", "is", null)
					.executeTakeFirst();
				if (!found) throw new CheckError({ key: UNKNOWN[row.kind], values: { id: row.id } });
			}
		},
		async preview(input, ctx): Promise<Preview> {
			const plan = await planMove(ctx, input.rows);
			const effects = await effectsOf(ctx, plan);
			return {
				summary: {
					key: "trash.movePreview",
					values: {
						count: plan.entries.length + plan.folders.length + plan.media.length,
						unpublished: effects.unpublished,
						kept: effects.kept,
					},
				},
				changes: [
					...plan.entries.map((entry) => ref("entry")(entry.id)),
					...plan.folders.map(ref("folder")),
					...plan.media.map(ref("media")),
				],
				blocked: [...plan.kept].map(([id, uses]) => ({
					ref: ref("media")(id),
					reason: { key: "media.inUse", values: { uses } },
				})),
			};
		},
		async run(input, ctx): Promise<TrashMoved> {
			const { db } = ctx;
			const schema = ctx.site.schema();
			// The engine has locked these records: a save that starts using a file is either seen here or waits and brings it back (09-4).
			const plan = await planMove(ctx, input.rows);
			const now = ctx.now();
			const by = actorName(ctx.actor);
			const ids = plan.entries.map((entry) => entry.id);
			const offSite = new Set<string>();
			if (ids.length > 0) {
				const published = await db
					.selectFrom("entry_published")
					.select(["entry_id", "slug"])
					.where("entry_id", "in", ids)
					.execute();
				const slugOf = new Map(published.map((row) => [row.entry_id, row.slug]));
				for (const entry of plan.entries) {
					const slug = slugOf.get(entry.id);
					const document = schema.collections[entry.collection]?.kind === "document";
					if (slug !== undefined) {
						// The path it leaves is written down: a permanent delete keeps it from every other entry (doc 11, principle 5).
						await db
							.insertInto("old_paths")
							.values({ collection: entry.collection, locale: entry.locale, slug, entry_id: entry.id })
							.onConflict((conflict) =>
								conflict.columns(["collection", "locale", "slug"]).doUpdateSet({ entry_id: entry.id }),
							)
							.execute();
						if (document) offSite.add(entry.group);
						ctx.emit({
							type: "entry.unpublished",
							ids: [entry.id],
							collection: entry.collection,
							locale: entry.locale,
							paths: [publicPath(schema, entry.collection, slug, entry.locale) ?? []].flat(),
						});
					}
					await db
						.updateTable("entries")
						.set((eb) => ({
							trashed_at: now,
							trashed_by: by,
							version: eb("version", "+", 1),
							// A restored document is a draft: it reaches the site again only when a person publishes it (principle 3).
							...(slug !== undefined && document ? { status: "draft" as const, has_unpublished_changes: false } : {}),
						}))
						.where("id", "=", entry.id)
						.execute();
				}
				await db.deleteFrom("entry_published").where("entry_id", "in", ids).execute();
				// Whatever listens to saves (a search index) hears that they are gone; what the site showed left with `entry.unpublished` above.
				emitByPlace(ctx, "entry.trashed", plan.entries);
			}
			if (plan.stamped.length > 0)
				await db
					.updateTable("entries")
					.set((eb) => ({ trashed_at: now, version: eb("version", "+", 1) }))
					.where("id", "in", plan.stamped)
					.execute();
			if (plan.folders.length > 0)
				await db
					.updateTable("folders")
					.set((eb) => ({ trashed_at: now, trashed_by: by, version: eb("version", "+", 1) }))
					.where("id", "in", plan.folders)
					.execute();
			if (plan.media.length > 0) {
				await db
					.updateTable("media")
					.set((eb) => ({ trashed_at: now, trashed_by: by, version: eb("version", "+", 1) }))
					.where("id", "in", plan.media)
					.execute();
				ctx.emit({ type: "media.trashed", ids: plan.media });
			}
			const gone = { folder: new Set(plan.folders), media: new Set(plan.media) };
			return {
				rows: input.rows.filter((row) => row.kind === "entry" || gone[row.kind].has(row.id)).length,
				entries: ids.length,
				unpublished: offSite.size,
				folders: plan.folders.length,
				moved: plan.media,
				kept: [...plan.kept.keys()].sort(),
			};
		},
		log: "trash",
		// Files in use that stayed are said with the count; otherwise one row is named and several are counted.
		summary: (input, output, records) =>
			output.kept.length > 0
				? { key: "trash.move", values: { count: output.rows, kept: output.kept.length } }
				: oneOrMany("trash.move", askedRecords(input.rows, records)),
		where: () => ({ key: "activity.where.trash" }),
	}),
	defineOperation({
		name: "trash.restore",
		kind: "write",
		description:
			"Bring rows of the trash back. A document comes back as a draft, where it was, with every language of it that is in the trash; a folder comes back with everything in it; and a thing whose folder is in the trash brings that folder back to sit in. A translation whose language the entry has again is refused.",
		input: Rows,
		async touches(input, ctx) {
			const plan = await planRestore(ctx, input.rows);
			return [
				...plan.entries.map((entry) => ref("entry")(entry.id)),
				...plan.folders.map((folder) => ref("folder")(folder.id)),
				...plan.media.map((file) => ref("media")(file.id)),
			];
		},
		async check(input, ctx) {
			await inTrash(ctx.db, input.rows);
			const { entries } = await planRestore(ctx, input.rows);
			const coming = new Set(entries.map((entry) => entry.id));
			for (const entry of entries) {
				const taken = await ctx.db
					.selectFrom("entries")
					.select("id")
					.where("translation_group", "=", entry.group)
					.where("locale", "=", entry.locale)
					.where("trashed_at", "is", null)
					.executeTakeFirst();
				if (taken && !coming.has(taken.id)) {
					const name = ctx.site.schema().locales.list.find((each) => each.code === entry.locale)?.name ?? entry.locale;
					throw new CheckError({ key: "trash.localeTaken", values: { locale: name } });
				}
			}
		},
		async preview(input, ctx): Promise<Preview> {
			const plan = await planRestore(ctx, input.rows);
			return {
				summary: {
					key: "trash.restorePreview",
					values: { count: plan.entries.length + plan.folders.length + plan.media.length },
				},
				changes: [
					...plan.entries.map((entry) => ref("entry")(entry.id)),
					...plan.folders.map((folder) => ref("folder")(folder.id)),
					...plan.media.map((file) => ref("media")(file.id)),
				],
			};
		},
		async run(input, ctx): Promise<TrashRestored> {
			const { db } = ctx;
			const schema = ctx.site.schema();
			const now = ctx.now();
			const plan = await planRestore(ctx, input.rows);
			// A folder gone for good holds nothing: what sat in it comes back at the top level.
			const boxOf = (id: string | null) => (id !== null && plan.boxes.has(id) ? id : null);
			for (const { id } of plan.folders) {
				const folder = plan.boxes.get(id);
				if (!folder) continue;
				const parent = boxOf(folder.parent_id);
				// A sibling may have taken its name meanwhile (doc 07); one that is being made waits, as for any folder named among its siblings.
				await lockFolderScope(db, folder.collection, parent);
				const name = await freeName(db, folder.collection, parent, folder.name, id);
				await db
					.updateTable("folders")
					.set((eb) => ({
						trashed_at: null,
						trashed_by: null,
						parent_id: parent,
						name,
						version: eb("version", "+", 1),
					}))
					.where("id", "=", id)
					.execute();
			}
			const renamed: TrashRestored["renamed"] = [];
			for (const entry of plan.entries) {
				const item = schema.collections[entry.collection]?.kind === "item";
				const slug = item ? await freeSlug(db, entry) : entry.slug;
				if (slug !== entry.slug) renamed.push({ from: entry.slug, to: slug });
				const row = await db
					.updateTable("entries")
					.set((eb) => ({
						trashed_at: null,
						trashed_by: null,
						folder_id: boxOf(entry.folderId),
						slug,
						version: eb("version", "+", 1),
					}))
					.where("id", "=", entry.id)
					.returning(["version", "values"])
					.executeTakeFirstOrThrow();
				if (!item) continue;
				// An item has no draft: it is on the site again, for the entries that point at it (doc 08).
				await db
					.insertInto("entry_published")
					.values({
						entry_id: entry.id,
						collection: entry.collection,
						locale: entry.locale,
						title: entry.title,
						slug,
						values: JSON.stringify(row.values),
						doc: null,
						published_at: now,
						from_version: row.version,
						block_hashes: JSON.stringify({}),
					})
					.execute();
				ctx.emit({
					type: "entry.published",
					ids: [entry.id],
					collection: entry.collection,
					locale: entry.locale,
					version: row.version,
					paths: [publicPath(schema, entry.collection, slug, entry.locale) ?? []].flat(),
				});
			}
			for (const file of plan.media)
				await db
					.updateTable("media")
					.set((eb) => ({
						trashed_at: null,
						trashed_by: null,
						folder_id: boxOf(file.folderId),
						version: eb("version", "+", 1),
					}))
					.where("id", "=", file.id)
					.execute();
			if (plan.media.length > 0) ctx.emit({ type: "media.restored", ids: plan.media.map((file) => file.id) });
			emitByPlace(ctx, "entry.restored", plan.entries);

			const [only] = input.rows;
			const asked =
				input.rows.length === 1 && only.kind === "entry" ? plan.entries.find((entry) => entry.id === only.id) : null;
			return {
				rows: input.rows.length,
				entry: asked
					? {
							id: asked.id,
							collection: asked.collection,
							draft: asked.status === "draft" && schema.collections[asked.collection]?.kind === "document",
						}
					: null,
				folders: plan.folders
					.filter((folder) => !folder.asked)
					.flatMap((folder) => plan.boxes.get(folder.id)?.name ?? []),
				renamed,
			};
		},
		log: "trash",
		summary: (input, _output, records) => oneOrMany("trash.restore", askedRecords(input.rows, records)),
		where: () => ({ key: "activity.where.trash" }),
	}),
	defineOperation({
		name: "trash.purge",
		kind: "write",
		humanOnly: true,
		description:
			"Delete rows of the trash for good. Only a person does it; it is never an agent tool. A path the entry was published under stays taken, and relations that pointed at it are cut.",
		input: Rows,
		touches: (input) => input.rows.map((row) => ref(row.kind)(row.id)),
		check: (input, ctx) => inTrash(ctx.db, input.rows),
		preview: (input): Preview => ({
			summary: { key: "trash.purge", values: { count: input.rows.length } },
			changes: input.rows.map((row) => ref(row.kind)(row.id)),
		}),
		async run(input, ctx) {
			emitByPlace(ctx, "entry.purged", await purgeRows(ctx.db, ctx.site.schema(), input.rows, ctx.now()));
			return { purged: input.rows.length };
		},
		afterCommit: sweepNow,
		log: "trash",
		summary: (input, _output, records) => oneOrMany("trash.purge", askedRecords(input.rows, records)),
		where: () => ({ key: "activity.where.trash" }),
	}),
	defineOperation({
		name: "trash.empty",
		kind: "write",
		humanOnly: true,
		description: "Delete everything in the trash for good. Only a person does it; it is never an agent tool.",
		input: z.object({}),
		// Every row is held, as a restore holds its own: one that comes back at this moment stays, and is not in what `run` reads next.
		touches: async (_input, ctx) => (await everyTrashRow(ctx.db)).map((row) => ref(row.kind)(row.id)),
		async preview(_input, ctx): Promise<Preview> {
			const rows = await everyTrashRow(ctx.db);
			return {
				summary: {
					key: "trash.empty",
					values: { count: await trashRowCount(ctx.db, ctx.site.schema().locales.source) },
				},
				changes: rows.map((row) => ref(row.kind)(row.id)),
			};
		},
		async run(_input, ctx) {
			const purged = await trashRowCount(ctx.db, ctx.site.schema().locales.source);
			emitByPlace(
				ctx,
				"entry.purged",
				await purgeRows(ctx.db, ctx.site.schema(), await everyTrashRow(ctx.db), ctx.now()),
			);
			return { purged };
		},
		afterCommit: sweepNow,
		log: "trash",
		summary: (_input, output) => ({ key: "trash.empty", values: { count: output.purged } }),
		where: () => ({ key: "activity.where.trash" }),
	}),
];
