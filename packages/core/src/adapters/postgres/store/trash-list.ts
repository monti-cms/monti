import { type RawBuilder, sql } from "kysely";
import { CmsError } from "../../../core/store/errors";
import type { TrashListRead } from "../../../core/store/trash";
import {
	type TrashEntryItem,
	type TrashFolderItem,
	type TrashItem,
	type TrashKind,
	type TrashListParams,
	type TrashMediaItem,
	trashExpiresAt,
} from "../../../core/trash";
import type { Db } from "../db/kysely";
import type { StoreContext } from "./context";
import { likeContainsPattern } from "./sql";
import { ROW_COLLECTION, titleExpr } from "./title-sql";

/**
 * Reading the trash. The units (an entry with the translations trashed with it, a folder, a media file) are found in one query over the three tables, each
 * with the date it counts from (its own, or the date of the top trashed folder it is in), whether it is at the top of the trash, and the text a search looks in.
 */

interface UnitRow {
	type: "entry" | "folder" | "media";
	id: string;
	kind: string;
	container_id: string | null;
	effective_at: Date;
	top_level: boolean;
	title: string | null;
	version: number | null;
}

interface PathRow {
	start_id: string;
	id: string;
	name: string;
	depth: number;
}

const DEFAULT_PAGE_SIZE = 25;

export function createTrashReads(ctx: StoreContext) {
	const { qSchema, site } = ctx;
	const db = ctx.db();
	const table = (name: string) => sql.id(qSchema, name);

	/**
	 * Every trashed folder with the date it counts from and the top trashed folder it is in: a trashed folder under a live one (or at the top) counts from its
	 * own date, and every trashed folder below it counts from the same date.
	 */
	const effectiveFolders = sql`
		effective(id, effective_at, top_id) as (
			select f.id, f.deleted_at, f.id
			from ${table("folders")} f left join ${table("folders")} p on p.id = f.parent_id
			where f.deleted_at is not null and (p.id is null or p.deleted_at is null)
			union all
			select c.id, e.effective_at, e.top_id
			from ${table("folders")} c join effective e on c.parent_id = e.id
			where c.deleted_at is not null
		)`;

	const entryTitle = titleExpr(site, "w.metadata", ROW_COLLECTION);
	const translationTitle = titleExpr(site, "tw.metadata", { column: "t.collection" });

	/** The units of the trash, one row each. A translation trashed together with its source is not a unit: it is a language of the source's row. */
	const units = sql`
		units as (
			select 'entry'::text as type, e.id, e.collection as kind, e.folder_id as container_id,
				coalesce(fe.effective_at, e.deleted_at) as effective_at, (fe.id is null) as top_level,
				${entryTitle} as title, e.version,
				concat_ws(' ', ${entryTitle}, e.working_slug,
					(select a.slug from ${table("content_addresses")} a where a.entry_id = e.id and a.type = 'current'),
					(select string_agg(concat_ws(' ', ${translationTitle}, t.working_slug), ' ')
						from ${table("entries")} t join ${table("entry_bodies")} tw on tw.entry_id = t.id and tw.state = 'working'
						where t.translation_group_id = e.id and t.id <> e.id and t.status = 'trashed' and t.deleted_at = e.deleted_at)
				) as search_text
			from ${table("entries")} e
			join ${table("entry_bodies")} w on w.entry_id = e.id and w.state = 'working'
			left join effective fe on fe.id = e.folder_id
			left join ${table("entries")} s on s.id = e.translation_group_id and s.id <> e.id
			where e.status = 'trashed' and not coalesce(s.status = 'trashed' and s.deleted_at = e.deleted_at, false)
			union all
			select 'folder'::text, f.id, f.collection, f.parent_id, fe.effective_at, (f.id = fe.top_id), f.name, f.version, f.name
			from ${table("folders")} f join effective fe on fe.id = f.id
			union all
			select 'media'::text, m.id, 'media', m.folder_id, coalesce(fe.effective_at, m.deleted_at), (fe.id is null), m.filename, null::int, m.filename
			from ${table("media_assets")} m left join effective fe on fe.id = m.folder_id
			where m.status = 'trashed'
		)`;

	const withUnits = (select: RawBuilder<unknown>) => sql`with recursive ${effectiveFolders}, ${units} ${select}`;

	/** The folders from each of `ids` up to the top, nearest first, as names: the path of what sits in them. */
	const pathsOf = async (db_: Db, ids: readonly string[]): Promise<Map<string, string[]>> => {
		const paths = new Map<string, string[]>();
		const wanted = [...new Set(ids)];
		if (wanted.length === 0) return paths;
		const result = await sql<PathRow>`
			with recursive chain(start_id, id, parent_id, name, depth) as (
				select f.id, f.id, f.parent_id, f.name, 0 from ${table("folders")} f where f.id = any(${wanted}::uuid[])
				union all
				select c.start_id, f.id, f.parent_id, f.name, c.depth + 1
				from ${table("folders")} f join chain c on f.id = c.parent_id
			)
			select start_id, id, name, depth from chain order by start_id, depth desc`.execute(db_);
		for (const row of result.rows) paths.set(row.start_id, [...(paths.get(row.start_id) ?? []), row.name]);
		return paths;
	};

	const asDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));

	/** The folders in `ids` as trash items: with their date, path and what is in them. */
	const readFolderItems = async (ids: readonly string[]): Promise<Map<string, TrashFolderItem>> => {
		const items = new Map<string, TrashFolderItem>();
		if (ids.length === 0) return items;
		const rows = await withUnits(
			sql`select u.id, u.kind, u.title as name, u.version, u.effective_at, u.top_level, u.container_id
				from units u where u.type = 'folder' and u.id = any(${[...ids]}::uuid[])`,
		).execute(db);
		const counts = await sql<{ root: string; folders: string; entries: string; files: string }>`
			with recursive sub(root, id) as (
				select f.id, f.id from ${table("folders")} f where f.id = any(${[...ids]}::uuid[])
				union all
				select s.root, f.id from ${table("folders")} f join sub s on f.parent_id = s.id
			)
			select s.root,
				(select count(*) - 1 from sub s2 where s2.root = s.root)::text as folders,
				(select count(distinct coalesce(e.translation_group_id, e.id)) from sub s3
					join ${table("entries")} e on e.folder_id = s3.id where s3.root = s.root)::text as entries,
				(select count(*) from sub s4 join ${table("media_assets")} m on m.folder_id = s4.id
					where s4.root = s.root and m.status = 'trashed')::text as files
			from sub s group by s.root`.execute(db);
		const countOf = new Map(counts.rows.map((row) => [row.root, row]));
		const typed = rows.rows as unknown as (UnitRow & { name: string })[];
		const paths = await pathsOf(
			db,
			typed.flatMap((row) => (row.container_id ? [row.container_id] : [])),
		);
		for (const row of typed) {
			const count = countOf.get(row.id);
			const effective = asDate(row.effective_at);
			items.set(row.id, {
				type: "folder",
				id: row.id,
				collection: row.kind,
				name: row.name,
				version: row.version ?? 1,
				deletedAt: effective,
				expiresAt: row.top_level ? trashExpiresAt(effective) : null,
				path: row.container_id ? (paths.get(row.container_id) ?? []) : [],
				entries: Number(count?.entries ?? 0),
				folders: Number(count?.folders ?? 0),
				files: Number(count?.files ?? 0),
			});
		}
		return items;
	};

	const readEntryItems = async (rows: readonly UnitRow[]): Promise<Map<string, TrashEntryItem>> => {
		const items = new Map<string, TrashEntryItem>();
		if (rows.length === 0) return items;
		const ids = rows.map((row) => row.id);
		const details = await sql<{
			id: string;
			locale: string;
			translation_group_id: string;
			version: number;
			working_slug: string | null;
			everpublished: boolean;
			source_trashed: boolean;
			source_title: string | null;
			locales: string[] | null;
			usages: string;
		}>`
			select e.id, e.locale, coalesce(e.translation_group_id, e.id) as translation_group_id, e.version, e.working_slug,
				(e.published_at is not null or exists (select 1 from ${table("content_addresses")} a
					where a.entry_id = e.id and a.type in ('current', 'alias'))) as everpublished,
				coalesce(s.status = 'trashed', false) as source_trashed,
				${titleExpr(site, "sw.metadata", { column: "s.collection" })} as source_title,
				(select array_agg(t.locale order by t.locale) from ${table("entries")} t
					where t.translation_group_id = e.id and t.id <> e.id and t.status = 'trashed' and t.deleted_at = e.deleted_at) as locales,
				(select count(distinct r.entry_id) from ${table("entry_references")} r
					where r.target_entry_id = e.id and r.entry_id <> e.id
					and jsonb_path_exists(r.occurrences, '$[*] ? (@.type == "metadata")'))::text as usages
			from ${table("entries")} e
			left join ${table("entries")} s on s.id = e.translation_group_id and s.id <> e.id
			left join ${table("entry_bodies")} sw on sw.entry_id = s.id and sw.state = 'working'
			where e.id = any(${ids}::uuid[])`.execute(db);
		const folderIds = rows.flatMap((row) => (row.container_id ? [row.container_id] : []));
		const paths = await pathsOf(db, folderIds);
		const byId = new Map(rows.map((row) => [row.id, row]));
		for (const detail of details.rows) {
			const row = byId.get(detail.id);
			if (!row) continue;
			const effective = asDate(row.effective_at);
			const isSource = detail.translation_group_id === detail.id;
			items.set(detail.id, {
				type: "entry",
				id: detail.id,
				collection: row.kind,
				locale: detail.locale,
				translationGroupId: detail.translation_group_id,
				isSource,
				title: row.title,
				slug: detail.working_slug,
				version: detail.version,
				deletedAt: effective,
				expiresAt: row.top_level ? trashExpiresAt(effective) : null,
				locales: [detail.locale, ...(detail.locales ?? [])],
				everPublished: detail.everpublished,
				sourceTrashed: !isSource && detail.source_trashed,
				sourceTitle: isSource ? null : detail.source_title,
				path: row.container_id ? (paths.get(row.container_id) ?? []) : [],
				usages: Number(detail.usages),
			});
		}
		return items;
	};

	const readMediaItems = async (
		rows: readonly UnitRow[],
	): Promise<{ items: Map<string, TrashMediaItem>; keys: Record<string, string> }> => {
		const items = new Map<string, TrashMediaItem>();
		const keys: Record<string, string> = {};
		if (rows.length === 0) return { items, keys };
		const found = await db
			.selectFrom("media_assets")
			.select([
				"id",
				"filename",
				"mime_type",
				"byte_size",
				"width",
				"height",
				"default_alt",
				"folder_id",
				"storage_key",
			])
			.where("id", "=", sql<string>`any(${rows.map((row) => row.id)}::uuid[])`)
			.execute();
		const paths = await pathsOf(
			db,
			found.flatMap((media) => (media.folder_id ? [media.folder_id] : [])),
		);
		const byId = new Map(rows.map((row) => [row.id, row]));
		for (const media of found) {
			const row = byId.get(media.id);
			if (!row) continue;
			const effective = asDate(row.effective_at);
			if (media.storage_key) keys[media.id] = media.storage_key;
			items.set(media.id, {
				type: "media",
				id: media.id,
				filename: media.filename,
				mimeType: media.mime_type,
				byteSize: media.byte_size === null ? null : Number(media.byte_size),
				width: media.width,
				height: media.height,
				alt: media.default_alt,
				folderId: media.folder_id,
				deletedAt: effective,
				expiresAt: row.top_level ? trashExpiresAt(effective) : null,
				path: media.folder_id ? (paths.get(media.folder_id) ?? []) : [],
				url: null,
			});
		}
		return { items, keys };
	};

	return {
		/** The top-level units, all of them, newest discarded first: what emptying and the purge go through. */
		topUnits: async (): Promise<UnitRow[]> => {
			const result = await withUnits(
				sql`select u.type, u.id, u.kind, u.container_id, u.effective_at, u.top_level, u.title, u.version
					from units u where u.top_level order by u.effective_at desc, u.id`,
			).execute(db);
			return (result.rows as unknown as UnitRow[]).map((row) => ({ ...row, effective_at: asDate(row.effective_at) }));
		},

		readFolderItems,

		listTrash: async (params: TrashListParams): Promise<TrashListRead> => {
			const page = Math.max(1, params.page || 1);
			const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
			const direction = params.direction === "asc" ? sql`asc` : sql`desc`;
			const search = params.search?.trim();

			let folder: TrashFolderItem | undefined;
			if (params.folderId) {
				folder = (await readFolderItems([params.folderId])).get(params.folderId);
				if (!folder) throw new CmsError("Folder not found in the trash", "not_found");
			}

			// A search looks everywhere; otherwise the top of the trash, or the direct children of the folder being looked into.
			const scope = search
				? sql`u.search_text ilike ${likeContainsPattern(search)}`
				: params.folderId
					? sql`u.container_id = ${params.folderId}::uuid`
					: sql`u.top_level`;
			const kindFilter =
				params.kinds && params.kinds.length > 0 ? sql`and u.kind = any(${[...params.kinds]}::text[])` : sql``;

			const found = await withUnits(
				sql`select u.type, u.id, u.kind, u.container_id, u.effective_at, u.top_level, u.title, u.version,
						count(*) over ()::text as total
					from units u where ${scope} ${kindFilter}
					order by u.effective_at ${direction}, u.id
					limit ${pageSize} offset ${(page - 1) * pageSize}`,
			).execute(db);
			const rows = found.rows as unknown as (UnitRow & { total: string })[];
			// An offset past the last row has no row to carry the total.
			const total =
				rows[0] !== undefined
					? Number(rows[0].total)
					: Number(
							(
								(
									await withUnits(
										sql`select count(*)::text as total from units u where ${scope} ${kindFilter}`,
									).execute(db)
								).rows[0] as { total?: string } | undefined
							)?.total ?? 0,
						);

			const kindRows = await withUnits(
				sql`select u.kind, count(*)::text as count from units u where u.top_level group by u.kind`,
			).execute(db);
			const kinds: Record<TrashKind, number> = {};
			for (const row of kindRows.rows as unknown as { kind: string; count: string }[])
				kinds[row.kind] = Number(row.count);

			const ofType = (type: UnitRow["type"]) => rows.filter((row) => row.type === type);
			const [entries, folders, media] = await Promise.all([
				readEntryItems(ofType("entry")),
				readFolderItems(ofType("folder").map((row) => row.id)),
				readMediaItems(ofType("media")),
			]);
			const items: TrashItem[] = [];
			for (const row of rows) {
				const item =
					row.type === "entry"
						? entries.get(row.id)
						: row.type === "folder"
							? folders.get(row.id)
							: media.items.get(row.id);
				if (item) items.push(item);
			}
			return { items, total, kinds, ...(folder ? { folder } : {}), mediaKeys: media.keys };
		},
	};
}

export type { UnitRow };
