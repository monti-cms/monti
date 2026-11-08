import { type Kysely, sql, type Transaction } from "kysely";
import { z } from "zod";
import { randomUUID } from "../bytes";
import type { Database } from "../db/schema";
import { loadEntries } from "../entries/record";
import { CheckError } from "../errors";
import { folderOf, subtree } from "../folders/operations";
import { defineOperation, type Message, type OperationContext, type RecordRef } from "../operation";
import { lockRecords } from "../records";
import { isTranslation, sourceEntryOf, translatedFields } from "../translations/source";
import { isMediaKey, type MediaKind, splitName, WEB_LONGEST_SIDE } from "./accept";
import { altGaps } from "./alt";
import { usedOf } from "./uses";
import { type MediaPlace, placeOf } from "./value";

type Db = Kysely<Database> | Transaction<Database>;

const mediaRef = (id: string): RecordRef => ({ kind: "media", id });
const folderRef = (id: string): RecordRef => ({ kind: "folder", id });

const moveMessage = (count: number, name: string | null): Message =>
	name === null
		? { key: "media.moveToTop", values: { count } }
		: { key: "media.moveToFolder", values: { count, name } };

/** How many files one page of the library holds. */
export const MEDIA_PAGE_SIZE = 100;

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

export type MediaQueryResult = {
	/** Whether the site has a storage. Without one the library shows how to connect one. */
	storage: boolean;
	items: MediaItem[];
	total: number;
	page: number;
	pageSize: number;
	/** The open folder's own files, for the filter menus. */
	counts: { image: number; file: number; used: number; unused: number };
};

/** One place a file is used. */
export type MediaUseRow =
	| {
			owner: "entry";
			id: string;
			collection: string;
			locale: string;
			title: string;
			trashed: boolean;
			place: MediaPlace;
	  }
	| { owner: "template"; id: string; name: string; place: MediaPlace };

export type MediaDetail = MediaItem & { useRows: MediaUseRow[]; trashedAt: string | null };

/** An image with no alt text, and where. */
export type MissingAlt = {
	id: string;
	collection: string;
	locale: string;
	title: string;
	media: string;
	name?: string | null;
	place: MediaPlace;
};

/** What `media.trash` did: files in use stay. */
export type MediaTrashResult = { moved: string[]; kept: string[] };

const Size = z.number().int().positive();
const Original = z.object({ key: z.string(), width: Size.optional(), height: Size.optional() });
const Web = z.object({ key: z.string(), width: Size.max(WEB_LONGEST_SIDE), height: Size.max(WEB_LONGEST_SIDE) });
type Original = z.infer<typeof Original>;
type Web = z.infer<typeof Web>;

const COLUMNS = [
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

const usesCount = sql<number>`(select count(distinct coalesce(u.entry_id, u.template_id))::int from media_uses u where u.media_id = media.id)`;

type Row = {
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
async function folderPaths(db: Db): Promise<(id: string | null) => string[]> {
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

function itemOf(row: Row, ctx: OperationContext, pathOf: (id: string | null) => string[]): MediaItem {
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

async function rowOf(db: Db, id: string): Promise<(Row & { trashed_at: Date | null }) | undefined> {
	return db.selectFrom("media").select(COLUMNS).select(usesCount.as("uses")).where("id", "=", id).executeTakeFirst();
}

async function liveRowOf(db: Db, id: string) {
	const row = await rowOf(db, id);
	if (!row || row.trashed_at) throw new CheckError({ key: "media.unknown", values: { id } });
	return row;
}

async function liveItem(ctx: OperationContext, id: string): Promise<MediaItem> {
	return itemOf(await liveRowOf(ctx.db, id), ctx, await folderPaths(ctx.db));
}

function storageOf(ctx: OperationContext) {
	if (!ctx.site.storage) throw new CheckError({ key: "media.noStorage" });
	return ctx.site.storage;
}

/** A key must be one the byte route gave, with a file behind it, and no other file's. */
async function statOfKey(ctx: OperationContext, key: string, self?: string) {
	const stat = isMediaKey(key) ? await storageOf(ctx).stat(key) : null;
	if (!stat) throw new CheckError({ key: "media.unknownKey", values: { key } });
	let taken = ctx.db
		.selectFrom("media")
		.select("id")
		.where((eb) => eb.or([eb("original_key", "=", key), eb("web_key", "=", key)]));
	if (self) taken = taken.where("id", "!=", self);
	if (await taken.executeTakeFirst()) throw new CheckError({ key: "media.keyTaken", values: { key } });
	return stat;
}

/**
 * The file behind an upload's keys, after everything a key must be. The keys are locked first: two uploads at once naming each other's keys would each find them free,
 * and a key is unique only within its own column.
 */
async function statOfKeys(ctx: OperationContext, original: Original, web: Web | undefined, self?: string) {
	await lockRecords(
		ctx.db,
		[original.key, ...(web ? [web.key] : [])].map((id) => ({ kind: "mediaKey", id })),
	);
	if (web?.key === original.key) throw new CheckError({ key: "media.keyTaken", values: { key: web.key } });
	const stat = await statOfKey(ctx, original.key, self);
	if (web) {
		const webStat = await statOfKey(ctx, web.key, self);
		if (kindOf(stat.mime) !== "image" || kindOf(webStat.mime) !== "image")
			throw new CheckError({ key: "media.badWeb" });
	}
	return stat;
}

const kindOf = (mime: string): MediaKind => (mime.startsWith("image/") ? "image" : "file");

/** A name a person gave: the file's extension stays (doc 09: it says what the file is), slashes do not make paths. */
function cleanName(name: string, extension: string) {
	const given = name.trim().replaceAll("/", "-");
	const { stem, extension: typed } = splitName(given);
	const base = typed === extension ? stem : given;
	if (base === "") throw new CheckError({ key: "media.badName" });
	return `${base}${extension}`;
}

const Query = z.object({
	/** `null` is the top level; left out, every folder. */
	folder: z.string().nullable().optional(),
	/** Inside a folder: that folder (`here`), or the whole library (`all`). */
	scope: z.enum(["here", "all"]).default("here"),
	search: z.string().default(""),
	kinds: z.array(z.enum(["image", "file"])).default([]),
	used: z.array(z.enum(["used", "unused"])).default([]),
	sort: z.enum(["uploaded", "name", "size"]).default("uploaded"),
	page: z.number().int().positive().default(1),
	/** These files, wherever they are: what a screen asks when a body or a field names them. */
	ids: z.array(z.string()).optional(),
});

export const mediaOperations = [
	defineOperation({
		name: "media.query",
		kind: "read",
		description:
			"Find files in the media library by folder, name, kind (image or file) and whether anything uses them, newest upload first or by name or size. Each has how many entries use it. Alt text is not here: it belongs to the entries that use a file (see entries.missingAlt).",
		input: Query,
		async run(input, ctx): Promise<MediaQueryResult> {
			const search = input.search.trim();
			const looking = search !== "" || input.kinds.length > 0 || input.used.length > 0;
			const live = ctx.db.selectFrom("media").where("trashed_at", "is", null);
			let filtered = live;
			if (input.ids)
				filtered = input.ids.length > 0 ? filtered.where("id", "in", input.ids) : filtered.where(sql<boolean>`false`);
			else if (input.folder !== undefined && input.scope === "here") {
				// A folder lists what sits right in it; a search or a filter looks for files, so it goes through the subfolders (as the entry list, doc 07).
				if (input.folder !== null && looking)
					filtered = filtered.where("folder_id", "in", [input.folder, ...(await subtree(ctx.db, input.folder))]);
				else if (input.folder !== null) filtered = filtered.where("folder_id", "=", input.folder);
				else if (!looking) filtered = filtered.where("folder_id", "is", null);
			}
			if (search !== "")
				filtered = filtered.where("name", "ilike", `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`);
			if (input.kinds.length > 0) filtered = filtered.where("kind", "in", input.kinds);
			if (input.used.length === 1)
				filtered = filtered.where(
					input.used[0] === "used" ? sql<boolean>`${usesCount} > 0` : sql<boolean>`${usesCount} = 0`,
				);
			const { total } = await filtered.select(sql<number>`count(*)::int`.as("total")).executeTakeFirstOrThrow();
			const ordered =
				input.sort === "name"
					? filtered.orderBy("name")
					: input.sort === "size"
						? filtered.orderBy("size", "desc")
						: filtered.orderBy("uploaded_at", "desc");
			const rows = await ordered
				.select(COLUMNS)
				.select(usesCount.as("uses"))
				.orderBy("id")
				.limit(MEDIA_PAGE_SIZE)
				.offset((input.page - 1) * MEDIA_PAGE_SIZE)
				.execute();
			const own =
				input.folder === undefined || input.folder === null
					? live.where("folder_id", "is", null)
					: live.where("folder_id", "=", input.folder);
			const counted = await own
				.select([
					sql<number>`count(*) filter (where kind = 'image')::int`.as("image"),
					sql<number>`count(*) filter (where kind = 'file')::int`.as("file"),
					sql<number>`count(*) filter (where ${usesCount} > 0)::int`.as("used"),
					sql<number>`count(*) filter (where ${usesCount} = 0)::int`.as("unused"),
				])
				.executeTakeFirstOrThrow();
			const pathOf = await folderPaths(ctx.db);
			return {
				storage: ctx.site.storage !== null,
				items: rows.map((row) => itemOf(row, ctx, pathOf)),
				total: Number(total),
				page: input.page,
				pageSize: MEDIA_PAGE_SIZE,
				counts: {
					image: Number(counted.image),
					file: Number(counted.file),
					used: Number(counted.used),
					unused: Number(counted.unused),
				},
			};
		},
	}),
	defineOperation({
		name: "media.get",
		kind: "read",
		description:
			"One file of the media library, with every place it is used: which entry or template, and which field or body block.",
		input: z.object({ id: z.string() }),
		async run(input, ctx): Promise<MediaDetail> {
			const row = await rowOf(ctx.db, input.id);
			if (!row) throw new CheckError({ key: "media.unknown", values: { id: input.id } });
			const entries = await ctx.db
				.selectFrom("media_uses")
				.innerJoin("entries", "entries.id", "media_uses.entry_id")
				.select([
					"entries.id",
					"entries.collection",
					"entries.locale",
					"entries.title",
					"entries.trashed_at",
					"media_uses.place",
				])
				.where("media_uses.media_id", "=", input.id)
				.orderBy("entries.title")
				.orderBy("media_uses.place")
				.execute();
			const templates = await ctx.db
				.selectFrom("media_uses")
				.innerJoin("templates", "templates.id", "media_uses.template_id")
				.select(["templates.id", "templates.name", "media_uses.place"])
				.where("media_uses.media_id", "=", input.id)
				.orderBy("templates.name")
				.orderBy("media_uses.place")
				.execute();
			return {
				...itemOf(row, ctx, await folderPaths(ctx.db)),
				trashedAt: row.trashed_at && new Date(row.trashed_at).toISOString(),
				useRows: [
					...entries.map(
						(use): MediaUseRow => ({
							owner: "entry",
							id: use.id,
							collection: use.collection,
							locale: use.locale,
							title: use.title,
							trashed: use.trashed_at !== null,
							place: placeOf(use.place),
						}),
					),
					...templates.map(
						(use): MediaUseRow => ({ owner: "template", id: use.id, name: use.name, place: placeOf(use.place) }),
					),
				],
			};
		},
	}),
	defineOperation({
		name: "media.upload",
		kind: "write",
		humanOnly: true,
		description:
			"Add a file whose bytes went up through the admin's byte route. Only a person uploads: an agent has no file to give.",
		input: z.object({
			name: z.string().min(1),
			folderId: z.string().nullable().optional(),
			original: Original,
			web: Web.optional(),
		}),
		touches: (input) => (input.folderId ? [folderRef(input.folderId)] : []),
		async run(input, ctx): Promise<MediaItem> {
			storageOf(ctx);
			if (input.folderId) await checkMediaFolder(ctx.db, input.folderId);
			const stat = await statOfKeys(ctx, input.original, input.web);
			const id = randomUUID();
			await ctx.db
				.insertInto("media")
				.values({
					id,
					folder_id: input.folderId ?? null,
					name: cleanName(input.name, splitName(input.original.key).extension || splitName(input.name).extension),
					kind: kindOf(stat.mime),
					mime: stat.mime,
					size: stat.size,
					original_key: input.original.key,
					original_width: input.original.width ?? null,
					original_height: input.original.height ?? null,
					web_key: input.web?.key ?? null,
					web_width: input.web?.width ?? null,
					web_height: input.web?.height ?? null,
					uploaded_at: ctx.now(),
					trashed_at: null,
				})
				.execute();
			ctx.created(mediaRef(id));
			ctx.emit({ type: "media.uploaded", ids: [id] });
			return liveItem(ctx, id);
		},
		summary: (_input, output) => ({ key: "media.upload", values: { name: output.name } }),
	}),
	defineOperation({
		name: "media.update",
		kind: "write",
		description:
			"Rename a file in the media library. Its extension stays. Alt text and captions are not here: they belong to the entries that use it.",
		input: z.object({ id: z.string(), name: z.string().min(1) }),
		touches: (input) => [mediaRef(input.id)],
		preview: (input) => ({
			summary: { key: "media.update", values: { name: input.name } },
			changes: [mediaRef(input.id)],
		}),
		async check(input, ctx) {
			const row = await liveRowOf(ctx.db, input.id);
			cleanName(input.name, splitName(row.name).extension);
		},
		async run(input, ctx): Promise<MediaItem> {
			const row = await liveRowOf(ctx.db, input.id);
			await ctx.db
				.updateTable("media")
				.set((eb) => ({
					name: cleanName(input.name, splitName(row.name).extension),
					version: eb("version", "+", 1),
				}))
				.where("id", "=", input.id)
				.execute();
			return liveItem(ctx, input.id);
		},
		summary: (_input, output) => ({ key: "media.update", values: { name: output.name } }),
	}),
	defineOperation({
		name: "media.replace",
		kind: "write",
		humanOnly: true,
		description:
			"Replace a file's bytes with a new upload: every place that uses it now shows the new file, with its alt text and caption unchanged. Only a person replaces a file. The preview counts the uses.",
		input: z.object({ id: z.string(), original: Original, web: Web.optional() }),
		touches: (input) => [mediaRef(input.id)],
		async preview(input, ctx) {
			const row = await liveRowOf(ctx.db, input.id);
			return {
				summary: { key: "media.replacePreview", values: { name: row.name, uses: Number(row.uses) } },
				changes: [mediaRef(input.id)],
			};
		},
		async run(input, ctx): Promise<MediaItem> {
			const row = await liveRowOf(ctx.db, input.id);
			const stat = await statOfKeys(ctx, input.original, input.web, input.id);
			if (kindOf(stat.mime) !== row.kind) throw new CheckError({ key: "media.kindChanged" });
			const { stem } = splitName(row.name);
			await ctx.db
				.updateTable("media")
				.set((eb) => ({
					name: `${stem}${splitName(input.original.key).extension}`,
					mime: stat.mime,
					size: stat.size,
					original_key: input.original.key,
					original_width: input.original.width ?? null,
					original_height: input.original.height ?? null,
					web_key: input.web?.key ?? null,
					web_width: input.web?.width ?? null,
					web_height: input.web?.height ?? null,
					uploaded_at: ctx.now(),
					version: eb("version", "+", 1),
				}))
				.where("id", "=", input.id)
				.execute();
			return liveItem(ctx, input.id);
		},
		summary: (_input, output) => ({ key: "media.replace", values: { name: output.name } }),
	}),
	defineOperation({
		name: "media.moveToFolder",
		kind: "write",
		description: "Move files of the media library into a folder, or to the top level with null.",
		input: z.object({ ids: z.array(z.string()).min(1), folder: z.string().nullable() }),
		// The target folder's lock too, in the order every write takes locks: a folder being removed either sees the files come in, or refuses them here (09-4).
		touches: (input) => [...(input.folder === null ? [] : [folderRef(input.folder)]), ...input.ids.map(mediaRef)],
		async preview(input, ctx) {
			const name = input.folder === null ? null : (await checkMediaFolder(ctx.db, input.folder)).name;
			return {
				summary: moveMessage(input.ids.length, name),
				changes: input.ids.map(mediaRef),
			};
		},
		async check(input, ctx) {
			if (input.folder !== null) await checkMediaFolder(ctx.db, input.folder);
			for (const id of input.ids) await liveRowOf(ctx.db, id);
		},
		async run(input, ctx) {
			const name = input.folder === null ? null : (await checkMediaFolder(ctx.db, input.folder)).name;
			await ctx.db
				.updateTable("media")
				.set((eb) => ({ folder_id: input.folder, version: eb("version", "+", 1) }))
				.where("id", "in", input.ids)
				.execute();
			return { count: input.ids.length, name };
		},
		summary: (_input, output) => moveMessage(output.count, output.name),
	}),
	defineOperation({
		name: "media.trash",
		kind: "write",
		description:
			"Put files of the media library in the trash. Files in use stay where they are: the preview says which move and which stay. Make a proposal only when asked to tidy up; files in use never go in one.",
		input: z.object({ ids: z.array(z.string()).min(1) }),
		touches: (input) => input.ids.map(mediaRef),
		async preview(input, ctx) {
			const used = await usedOf(ctx.db, input.ids);
			const moved = input.ids.filter((id) => !used.has(id));
			return {
				summary: { key: "media.trashPreview", values: { moved: moved.length, kept: used.size } },
				changes: moved.map(mediaRef),
				blocked: [...used].map(([id, uses]) => ({
					ref: mediaRef(id),
					reason: { key: "media.inUse", values: { uses } },
				})),
			};
		},
		async check(input, ctx) {
			for (const id of input.ids) await liveRowOf(ctx.db, id);
		},
		async run(input, ctx): Promise<MediaTrashResult> {
			// The engine has locked these files, so a save that starts using one has either finished, and is seen here, or waits and brings it back (09-4).
			const used = await usedOf(ctx.db, input.ids);
			const moved = input.ids.filter((id) => !used.has(id));
			if (moved.length > 0) {
				await ctx.db
					.updateTable("media")
					.set((eb) => ({ trashed_at: ctx.now(), version: eb("version", "+", 1) }))
					.where("id", "in", moved)
					.execute();
				ctx.emit({ type: "media.trashed", ids: moved });
			}
			return { moved, kept: [...used.keys()] };
		},
		summary: (_input, output) => ({
			key: "media.trash",
			values: { moved: output.moved.length, kept: output.kept.length },
		}),
	}),
	defineOperation({
		name: "entries.missingAlt",
		kind: "read",
		description:
			"The images with no alt text, entry by entry: where each sits (a field or a body block) and which file it shows. Read it before filling alt text; the alt text goes on the image in the entry, never in the library. Give ids, a collection, or neither for the whole site.",
		input: z.object({ ids: z.array(z.string()).optional(), collection: z.string().optional() }),
		async run(input, ctx): Promise<MissingAlt[]> {
			const schema = ctx.site.schema();
			let found = ctx.db.selectFrom("entries").select("id").where("trashed_at", "is", null);
			if (input.ids)
				found = input.ids.length > 0 ? found.where("id", "in", input.ids) : found.where(sql<boolean>`false`);
			if (input.collection) found = found.where("collection", "=", input.collection);
			const entries = await loadEntries(
				ctx.db,
				(await found.execute()).map((row) => row.id),
			);
			const missing: MissingAlt[] = [];
			for (const entry of entries) {
				const source = isTranslation(schema, entry)
					? await sourceEntryOf(ctx.db, schema, entry.translationGroup)
					: null;
				const { values } = translatedFields(schema, entry.collection, entry, source);
				const fields = schema.collections[entry.collection]?.fields ?? {};
				for (const gap of await altGaps(ctx.db, fields, values, entry.doc))
					missing.push({
						id: entry.id,
						collection: entry.collection,
						locale: entry.locale,
						title: entry.title,
						...gap,
					});
			}
			const names = new Map(
				missing.length === 0
					? []
					: (
							await ctx.db
								.selectFrom("media")
								.select(["id", "name"])
								.where(
									"id",
									"in",
									missing.map((gap) => gap.media),
								)
								.execute()
						).map((row) => [row.id, row.name]),
			);
			return missing.map((gap) => ({ ...gap, name: names.get(gap.media) ?? null }));
		},
	}),
];

/** A folder of the media library, not one of a collection's. */
async function checkMediaFolder(db: Db, id: string) {
	const folder = await folderOf(db, id);
	if (folder.collection !== null) throw new CheckError({ key: "folders.otherScope" });
	return folder;
}
