import { type Kysely, sql, type Transaction } from "kysely";
import type { Database } from "../db/schema";
import type { OperationContext } from "../operation";
import type { MediaKind } from "./accept";
import { usesInDoc } from "./uses";

type Db = Kysely<Database> | Transaction<Database>;

/** One stored size of a file. */
export type MediaFile = { url: string; width: number | null; height: number | null };

/** A file as the library shows it. There is no alt text here: that belongs to the entries that use it (doc 09, principle 5). */
export type MediaItem = {
	id: string;
	folderId: string | null;
	/** The folders above it, top first, itself not counted; for a search that reaches through folders. */
	path: string[];
	name: string;
	kind: MediaKind;
	mime: string;
	size: number;
	original: MediaFile;
	web: MediaFile | null;
	/** How many entries and templates use it. */
	uses: number;
	uploadedAt: string;
	version: number;
};

export const COLUMNS = [
	"media.id",
	"media.folder_id",
	"media.name",
	"media.kind",
	"media.mime",
	"media.size",
	"media.original_key",
	"media.original_width",
	"media.original_height",
	"media.web_key",
	"media.web_width",
	"media.web_height",
	"media.uploaded_at",
	"media.version",
	"media.trashed_at",
] as const;

export const usesCount = sql<number>`(select count(distinct coalesce(u.entry_id, u.template_id))::int from media_uses u where u.media_id = media.id)`;

export type Row = {
	id: string;
	folder_id: string | null;
	name: string;
	kind: MediaKind;
	mime: string;
	size: number;
	original_key: string;
	original_width: number | null;
	original_height: number | null;
	web_key: string | null;
	web_width: number | null;
	web_height: number | null;
	uploaded_at: Date;
	version: number;
	uses: number;
};

/** Every media folder's chain of names, for the paths a search shows. */
export async function folderPaths(db: Db): Promise<(id: string | null) => string[]> {
	const folders = await db
		.selectFrom("folders")
		.select(["id", "parent_id", "name"])
		.where("collection", "is", null)
		.execute();
	const byId = new Map(folders.map((folder) => [folder.id, folder]));
	return (id) => {
		const names: string[] = [];
		for (let at = id ? byId.get(id) : undefined; at; at = at.parent_id ? byId.get(at.parent_id) : undefined)
			names.unshift(at.name);
		return names;
	};
}

export function itemOf(row: Row, ctx: OperationContext, pathOf: (id: string | null) => string[]): MediaItem {
	const url = (key: string) => ctx.site.storage?.url(key) ?? "";
	return {
		id: row.id,
		folderId: row.folder_id,
		path: pathOf(row.folder_id),
		name: row.name,
		kind: row.kind,
		mime: row.mime,
		size: row.size,
		original: { url: url(row.original_key), width: row.original_width, height: row.original_height },
		web: row.web_key ? { url: url(row.web_key), width: row.web_width, height: row.web_height } : null,
		uses: Number(row.uses),
		uploadedAt: new Date(row.uploaded_at).toISOString(),
		version: row.version,
	};
}

/**
 * The library's files a body's blocks show, as `media.query` gives them. They come with the body that is read (`entries.get`, `templates.get`), so
 * the editor draws every picture's frame at its shape at once: read after the body, the shapes came late and the text under a picture moved.
 */
export async function mediaInDoc(ctx: OperationContext, doc: unknown): Promise<MediaItem[]> {
	const ids = [...new Set(usesInDoc(doc).map((use) => use.media))];
	if (ids.length === 0) return [];
	const rows = await ctx.db
		.selectFrom("media")
		.select(COLUMNS)
		.select(usesCount.as("uses"))
		.where("id", "in", ids)
		.execute();
	const pathOf = await folderPaths(ctx.db);
	return rows.map((row) => itemOf(row, ctx, pathOf));
}
