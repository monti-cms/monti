import { type Kysely, type RawBuilder, sql, type Transaction } from "kysely";
import { z } from "zod";
import type { Database } from "../db/schema";
import { publicPath } from "../entries/paths";
import { CheckError } from "../errors";
import type { MediaKind } from "../media/accept";
import type { OperationContext } from "../operation";
import { foldersUnder, TRASH_DAYS, type TrashRef } from "./purge";

type Db = Kysely<Database> | Transaction<Database>;

const DAY = 86_400_000;

/** The kind the trash names for the media library's files and folders, next to the collections' names. */
export const MEDIA_KIND = "media";

export const TrashQuery = z.object({
	/** A folder in the trash to look inside; left out, the trash itself. */
	folder: z.string().optional(),
	/** Searching inside a folder: that folder with its subfolders (`here`), or the whole trash (`all`). */
	scope: z.enum(["here", "all"]).default("here"),
	/** Words of a title, a name or an address. A search looks inside thrown-away folders too. */
	search: z.string().default(""),
	/** Collections to keep, and `media` for the library's files and folders; none keeps every kind. */
	kinds: z.array(z.string()).default([]),
	/** By when they were thrown away. */
	sort: z.enum(["newest", "oldest"]).default("newest"),
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(500).default(50),
});
export type TrashQuery = z.infer<typeof TrashQuery>;

/** One row of the trash (doc 11): an entry with every language of it that is there, a folder with what it holds, or a file. */
export type TrashRow = TrashRef & {
	version: number;
	/** The collection it belongs to; `null` for the media library's. */
	collection: string | null;
	title: string;
	/** An entry's public path, when its collection has one and it has a slug. */
	address: string | null;
	/** An entry's language, then the other languages of it in the trash. */
	locales: string[];
	/** A folder: how many entries or files it holds. */
	holds: number | null;
	/** A file: what it is and how large. */
	file: { kind: MediaKind; size: number } | null;
	/** The folder it sat in, and the names of the folders down to it, outermost first. */
	folderId: string | null;
	path: string[];
	/** Its folder is in the trash too: a search found it inside a thrown-away folder. */
	inTrashedFolder: boolean;
	trashedAt: string;
	/** Days until it is deleted for good. */
	daysLeft: number;
	byAssistant: boolean;
	/** Public paths a permanent delete keeps from every other entry: the ones it was published under. */
	reserves: string[];
};

export type TrashList = {
	rows: TrashRow[];
	total: number;
	/** How many rows each kind has here, for the kind menu: by collection, and `media`. */
	counts: Record<string, number>;
	/** The open folder, with the thrown-away folders above it. */
	place: {
		id: string;
		name: string;
		collection: string | null;
		version: number;
		daysLeft: number;
		trail: Trail;
	} | null;
};
type Trail = { id: string; name: string }[];

export const daysLeft = (trashedAt: Date, now: Date) =>
	Math.max(0, Math.ceil((new Date(trashedAt).getTime() + TRASH_DAYS * DAY - now.getTime()) / DAY));

const pattern = (words: string) => `%${words.trim().replace(/[\\%_]/g, "\\$&")}%`;
const list = (values: string[]) => sql.join(values.map((value) => sql`${value}`));

/**
 * An entry another row stands for: an entry's languages in the trash are one row (2026-11-11, owner), its source-language one when that is there, else the first
 * of them.
 */
const shownByAnother = (source: string) => sql<boolean>`exists (
	select 1 from entries o
	where o.translation_group = e.translation_group and o.trashed_at is not null and o.id <> e.id
		and (case when o.locale = ${source} then 0 else 1 end, o.locale, o.id)
			< (case when e.locale = ${source} then 0 else 1 end, e.locale, e.id))`;
const folderInTrash = (column: string) =>
	sql<boolean>`exists (select 1 from folders box where box.id = ${sql.ref(column)} and box.trashed_at is not null)`;

/**
 * The rows of the trash as one list: entries that are not shown by another's row, folders and files. Without a search, a thing whose folder is in the trash too is
 * shown inside that folder, not beside it.
 */
function rowsSql(where: {
	/** The site's source language: the entry that stands for its group. */
	source: string;
	inside: string[] | null;
	direct: string | null;
	search: string;
}): RawBuilder<unknown> {
	const place = (column: string) =>
		where.direct !== null
			? sql<boolean>`${sql.ref(column)} = ${where.direct}`
			: where.inside !== null
				? sql<boolean>`${sql.ref(column)} in (${list(where.inside)})`
				: where.search === ""
					? sql<boolean>`not ${folderInTrash(column)}`
					: sql<boolean>`true`;
	const like = pattern(where.search);
	const found = (columns: RawBuilder<unknown>) => (where.search === "" ? sql<boolean>`true` : columns);
	return sql`(
		select 'entry'::text as kind, e.id, e.collection as type, e.trashed_at, e.title
			from entries e where e.trashed_at is not null and not ${shownByAnother(where.source)} and ${place("e.folder_id")}
			and ${found(sql`(e.slug ilike ${like} or exists (
				select 1 from entries t
				where t.translation_group = e.translation_group and t.trashed_at is not null and t.title ilike ${like}))`)}
		union all
		select 'folder'::text, f.id, coalesce(f.collection, ${MEDIA_KIND}::text), f.trashed_at, f.name
			from folders f where f.trashed_at is not null and ${place("f.parent_id")} and ${found(sql`f.name ilike ${like}`)}
		union all
		select 'media'::text, m.id, ${MEDIA_KIND}::text, m.trashed_at, m.name
			from media m where m.trashed_at is not null and ${place("m.folder_id")} and ${found(sql`m.name ilike ${like}`)}
	)`;
}

/** How many rows the trash shows at its top level: the sidebar's number (T38). */
export async function trashRowCount(db: Db, source: string): Promise<number> {
	const { rows } = await sql<{ count: string }>`select count(*) as count from ${rowsSql({
		source,
		inside: null,
		direct: null,
		search: "",
	})} as found`.execute(db);
	return Number(rows[0]?.count ?? 0);
}

type FolderRow = {
	id: string;
	name: string;
	parent_id: string | null;
	collection: string | null;
	trashed_at: Date | null;
	version: number;
};

export async function listTrash(ctx: OperationContext, query: TrashQuery): Promise<TrashList> {
	const { db } = ctx;
	const schema = ctx.site.schema();
	const now = ctx.now();
	const folders = new Map<string, FolderRow>(
		(
			await db
				.selectFrom("folders")
				.select(["id", "name", "parent_id", "collection", "trashed_at", "version"])
				.execute()
		).map((row) => [row.id, row]),
	);
	const open = query.folder === undefined ? null : (folders.get(query.folder) ?? null);
	if (query.folder !== undefined && !open?.trashed_at) throw new CheckError({ key: "trash.unknown" });
	const searching = query.search.trim() !== "";
	const found = rowsSql({
		source: schema.locales.source,
		search: searching ? query.search : "",
		direct: open && !searching ? open.id : null,
		inside: open && searching && query.scope === "here" ? await foldersUnder(db, open.id) : null,
	});

	const counted = await sql<{ type: string; count: string }>`
		select type, count(*) as count from ${found} as found group by type`.execute(db);
	const counts = Object.fromEntries(counted.rows.map((row) => [row.type, Number(row.count)]));
	const kinds = query.kinds.length > 0 ? sql`where type in (${list(query.kinds)})` : sql``;
	const total = query.kinds.length > 0 ? query.kinds.reduce((sum, kind) => sum + (counts[kind] ?? 0), 0) : sum(counts);
	const order = query.sort === "newest" ? sql`desc` : sql`asc`;
	const page = await sql<{ kind: TrashRef["kind"]; id: string }>`
		select kind, id from ${found} as found ${kinds}
		order by trashed_at ${order}, id
		limit ${query.pageSize} offset ${(query.page - 1) * query.pageSize}`.execute(db);

	const ids = (kind: TrashRef["kind"]) => page.rows.filter((row) => row.kind === kind).map((row) => row.id);
	const pathOf = (id: string | null) => {
		const names: string[] = [];
		for (
			let at = id === null ? undefined : folders.get(id);
			at;
			at = at.parent_id ? folders.get(at.parent_id) : undefined
		)
			names.unshift(at.name);
		return names;
	};
	const inTrash = (id: string | null) => Boolean(id && folders.get(id)?.trashed_at);
	const rows = new Map<string, TrashRow>();
	const base = (trashedAt: Date, by: string | null) => ({
		address: null,
		locales: [],
		holds: null,
		file: null,
		trashedAt: new Date(trashedAt).toISOString(),
		daysLeft: daysLeft(trashedAt, now),
		byAssistant: by === "assistant",
		reserves: [],
	});

	const entryIds = ids("entry");
	if (entryIds.length > 0) {
		const entries = await db
			.selectFrom("entries")
			.select([
				"id",
				"collection",
				"locale",
				"translation_group",
				"title",
				"slug",
				"folder_id",
				"trashed_at",
				"trashed_by",
				"version",
			])
			.where("id", "in", entryIds)
			.execute();
		// Every language of each entry that is in the trash: the row names them, and a permanent delete keeps the paths of them all.
		const members = await db
			.selectFrom("entries")
			.select(["id", "translation_group", "locale"])
			.where(
				"translation_group",
				"in",
				entries.map((entry) => entry.translation_group),
			)
			.where("trashed_at", "is not", null)
			.orderBy("locale")
			.execute();
		const paths = await db
			.selectFrom("old_paths")
			.select(["entry_id", "collection", "locale", "slug"])
			.where(
				"entry_id",
				"in",
				members.map((row) => row.id),
			)
			.execute();
		const groupOf = new Map(members.map((row) => [row.id, row.translation_group]));
		for (const entry of entries) {
			rows.set(`entry:${entry.id}`, {
				...base(entry.trashed_at as Date, entry.trashed_by),
				kind: "entry",
				id: entry.id,
				version: entry.version,
				collection: entry.collection,
				title: entry.title,
				address:
					schema.collections[entry.collection]?.kind === "document" && entry.slug !== ""
						? publicPath(schema, entry.collection, entry.slug, entry.locale)
						: null,
				locales: [
					entry.locale,
					...members
						.filter((row) => row.translation_group === entry.translation_group && row.id !== entry.id)
						.map((row) => row.locale),
				],
				folderId: entry.folder_id,
				path: pathOf(entry.folder_id),
				inTrashedFolder: inTrash(entry.folder_id),
				reserves: paths
					.filter((path) => groupOf.get(path.entry_id) === entry.translation_group)
					.flatMap((path) => publicPath(schema, path.collection, path.slug, path.locale) ?? []),
			});
		}
	}

	const folderIds = ids("folder");
	if (folderIds.length > 0) {
		// What each folder holds itself; a row's number adds up its subfolders'.
		const entriesIn = await sql<{ folder_id: string; count: string }>`
			select e.folder_id, count(*) as count from entries e
			where e.trashed_at is not null and e.folder_id is not null and not ${shownByAnother(schema.locales.source)}
			group by e.folder_id`.execute(db);
		const filesIn = await db
			.selectFrom("media")
			.select(["folder_id", (eb) => eb.fn.countAll<string>().as("count")])
			.where("trashed_at", "is not", null)
			.where("folder_id", "is not", null)
			.groupBy("folder_id")
			.execute();
		const own = new Map<string, number>();
		for (const row of [...entriesIn.rows, ...filesIn])
			if (row.folder_id) own.set(row.folder_id, (own.get(row.folder_id) ?? 0) + Number(row.count));
		const children = new Map<string, string[]>();
		for (const folder of folders.values())
			if (folder.parent_id) children.set(folder.parent_id, [...(children.get(folder.parent_id) ?? []), folder.id]);
		const holds = (id: string): number =>
			(own.get(id) ?? 0) + (children.get(id) ?? []).reduce((sum, child) => sum + holds(child), 0);
		const by = await db.selectFrom("folders").select(["id", "trashed_by"]).where("id", "in", folderIds).execute();
		for (const id of folderIds) {
			const folder = folders.get(id);
			if (!folder?.trashed_at) continue;
			rows.set(`folder:${id}`, {
				...base(folder.trashed_at, by.find((row) => row.id === id)?.trashed_by ?? null),
				kind: "folder",
				id,
				version: folder.version,
				collection: folder.collection,
				title: folder.name,
				holds: holds(id),
				folderId: folder.parent_id,
				path: pathOf(folder.parent_id),
				inTrashedFolder: inTrash(folder.parent_id),
			});
		}
	}

	const mediaIds = ids("media");
	if (mediaIds.length > 0) {
		const files = await db
			.selectFrom("media")
			.select(["id", "name", "kind", "size", "folder_id", "trashed_at", "trashed_by", "version"])
			.where("id", "in", mediaIds)
			.execute();
		for (const file of files)
			rows.set(`media:${file.id}`, {
				...base(file.trashed_at as Date, file.trashed_by),
				kind: "media",
				id: file.id,
				version: file.version,
				collection: null,
				title: file.name,
				file: { kind: file.kind, size: file.size },
				folderId: file.folder_id,
				path: pathOf(file.folder_id),
				inTrashedFolder: inTrash(file.folder_id),
			});
	}

	const trail: Trail = [];
	for (let at = open?.parent_id ? folders.get(open.parent_id) : undefined; at?.trashed_at; ) {
		trail.unshift({ id: at.id, name: at.name });
		at = at.parent_id ? folders.get(at.parent_id) : undefined;
	}
	return {
		rows: page.rows.flatMap((row) => rows.get(`${row.kind}:${row.id}`) ?? []),
		total,
		counts,
		place: open?.trashed_at
			? {
					id: open.id,
					name: open.name,
					collection: open.collection,
					version: open.version,
					daysLeft: daysLeft(open.trashed_at, now),
					trail,
				}
			: null,
	};
}

const sum = (counts: Record<string, number>) => Object.values(counts).reduce((total, count) => total + count, 0);

/** An entry in the trash as its panel shows it (flow 5·19): every language of it that is there, and the entries that point at it. */
export type TrashedEntry = {
	id: string;
	collection: string;
	version: number;
	daysLeft: number;
	/** Its own language first, then the others in the trash. */
	locales: { locale: string; title: string; slug: string; address: string | null }[];
	/** The entries whose relations point at it (doc 08): they show it again once it is restored. */
	pointing: { id: string; collection: string; title: string; trashed: boolean }[];
	/** Public paths a permanent delete keeps from every other entry. */
	reserves: string[];
};

export async function trashedEntry(ctx: OperationContext, id: string): Promise<TrashedEntry> {
	const { db } = ctx;
	const schema = ctx.site.schema();
	const rows = await db
		.selectFrom("entries")
		.select(["id", "collection", "locale", "translation_group", "title", "slug", "version", "trashed_at"])
		.where("translation_group", "in", db.selectFrom("entries").select("translation_group").where("id", "=", id))
		.where("trashed_at", "is not", null)
		.orderBy("locale")
		.execute();
	const entry = rows.find((row) => row.id === id);
	if (!entry?.trashed_at) throw new CheckError({ key: "trash.unknown" });
	const links = await db
		.selectFrom("entry_links as l")
		.innerJoin("entries as e", "e.translation_group", "l.from_group")
		.select(["e.id", "e.collection", "e.locale", "e.title", "e.trashed_at", "e.translation_group"])
		.where("l.to_group", "=", entry.translation_group)
		.orderBy("e.title")
		.execute();
	// One row for each entry that points here: its source-language one where it has one.
	const pointing = new Map<string, (typeof links)[number]>();
	for (const link of links) {
		const seen = pointing.get(link.translation_group);
		if (!seen || link.locale === schema.locales.source) pointing.set(link.translation_group, link);
	}
	const paths = await db
		.selectFrom("old_paths")
		.select(["collection", "locale", "slug"])
		.where(
			"entry_id",
			"in",
			rows.map((row) => row.id),
		)
		.execute();
	return {
		id: entry.id,
		collection: entry.collection,
		version: entry.version,
		daysLeft: daysLeft(entry.trashed_at, ctx.now()),
		reserves: paths.flatMap((path) => publicPath(schema, path.collection, path.slug, path.locale) ?? []),
		locales: [entry, ...rows.filter((row) => row.id !== id)].map((row) => ({
			locale: row.locale,
			title: row.title,
			slug: row.slug,
			address: row.slug === "" ? null : publicPath(schema, row.collection, row.slug, row.locale),
		})),
		pointing: [...pointing.values()].map((link) => ({
			id: link.id,
			collection: link.collection,
			title: link.title,
			trashed: link.trashed_at !== null,
		})),
	};
}
