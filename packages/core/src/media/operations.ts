import { type Kysely, sql, type Transaction } from "kysely";
import { z } from "zod";
import { randomUUID } from "../bytes";
import type { Database } from "../db/schema";
import { loadEntries } from "../entries/record";
import { CheckError } from "../errors";
import { folderOf, subtree } from "../folders/operations";
import { defineOperation, type Message, type OperationContext, type RecordRef } from "../operation";
import { lockRecords } from "../records";
import { bodyAsRead, followedFields, isTranslation, sourceEntryOf, translatedFields } from "../translations/source";
import { loosen, looseUntil } from "../trash/purge";
import { isMediaKey, kindOf, type MediaKind, splitName, WEB_LONGEST_SIDE } from "./accept";
import { altGaps } from "./alt";
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

/** The most files one `media.query` returns: a window that loads more stops here, and a body reads its files in parts of this. */
export const MEDIA_QUERY_MOST = 1000;

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

const Size = z.number().int().positive();
const Original = z.object({ key: z.string(), width: Size.optional(), height: Size.optional() });
const Web = z.object({ key: z.string(), width: Size.max(WEB_LONGEST_SIDE), height: Size.max(WEB_LONGEST_SIDE) });
/** A picture's blurred stand-in, made by the browser that sent it (doc 09): a small data URL, never an address to fetch. */
const Placeholder = z
	.string()
	.max(4096)
	.regex(
		/^data:image\/(webp|png|jpeg);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/,
	);
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
	// A picture is drawn at its own size (doc 09): one with no size could not be drawn on the site.
	if (kindOf(stat.mime) === "image" && !(original.width && original.height))
		throw new CheckError({ key: "media.imageSize" });
	if (web) {
		const webStat = await statOfKey(ctx, web.key, self);
		if (kindOf(stat.mime) !== "image" || kindOf(webStat.mime) !== "image")
			throw new CheckError({ key: "media.badWeb" });
	}
	return stat;
}

/** These keys are a file's now: the clean-up no longer waits to remove them (doc 11). */
async function adopt(db: Db, original: Original, web: Web | undefined) {
	await db
		.deleteFrom("loose_files")
		.where("key", "in", [original.key, ...(web ? [web.key] : [])])
		.execute();
}

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
	/** What the asker can take at all (a library window for a picture). Unlike `kinds`, which someone looks for, it leaves a folder listing what sits right in it. */
	only: z.enum(["image", "file"]).optional(),
	used: z.array(z.enum(["used", "unused"])).default([]),
	sort: z.enum(["uploaded", "name", "size"]).default("uploaded"),
	page: z.number().int().positive().default(1),
	/** How many files a page holds. The library's screen keeps to pages of 100; a window that loads more asks for more. */
	pageSize: z.number().int().min(1).max(MEDIA_QUERY_MOST).default(MEDIA_PAGE_SIZE),
	/**
	 * These files, wherever they are, the trash too (as `media.get`): a body shows the files it holds, and a draft can hold one trashed since. An empty list asks
	 * for no file: it is how a body learns `storage`, whether the site can take uploads.
	 */
	ids: z.array(z.string()).optional(),
});

export const mediaOperations = [
	defineOperation({
		name: "media.query",
		kind: "read",
		description:
			"Find files in the media library by folder, name, kind (image or file) and whether anything uses them, newest upload first or by name or size. Each has how many entries use it. By ids, files in the trash come back too; media.get says whether one is. Alt text is not here: it belongs to the entries that use a file (see entries.missingAlt).",
		input: Query,
		async run(input, ctx): Promise<MediaQueryResult> {
			const search = input.search.trim();
			// A search or a filter looks for files, so it goes through folders; a folder on its own lists what sits right in it (2026-11-09, owner).
			const looking = search !== "" || input.kinds.length > 0 || input.used.length > 0;
			const live = ctx.db.selectFrom("media").where("trashed_at", "is", null);
			const asked =
				input.ids &&
				(input.ids.length > 0
					? ctx.db.selectFrom("media").where("id", "in", input.ids)
					: live.where(sql<boolean>`false`));
			let filtered = asked ?? live;
			if (!asked && input.folder !== undefined && input.scope === "here") {
				// A folder lists what sits right in it; a search or a filter looks for files, so it goes through the subfolders (as the entry list, doc 07).
				if (input.folder !== null && looking)
					filtered = filtered.where("folder_id", "in", [input.folder, ...(await subtree(ctx.db, input.folder))]);
				else if (input.folder !== null) filtered = filtered.where("folder_id", "=", input.folder);
				else if (!looking) filtered = filtered.where("folder_id", "is", null);
			}
			if (search !== "")
				filtered = filtered.where("name", "ilike", `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`);
			if (input.kinds.length > 0) filtered = filtered.where("kind", "in", input.kinds);
			if (input.only) filtered = filtered.where("kind", "=", input.only);
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
				.limit(input.pageSize)
				.offset((input.page - 1) * input.pageSize)
				.execute();
			// A menu's count is what picking it would find from here: the open folder and those under it, or everything. Files asked for by id are
			// counted among themselves: a body reading its pictures does not count the whole library (T110).
			const reach =
				asked ??
				(input.scope === "here" && input.folder
					? live.where("folder_id", "in", [input.folder, ...(await subtree(ctx.db, input.folder))])
					: live);
			const counted = await reach
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
				pageSize: input.pageSize,
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
			placeholder: Placeholder.optional(),
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
					// Only a picture has one: a site blurs it in while the picture comes.
					placeholder: kindOf(stat.mime) === "image" ? (input.placeholder ?? null) : null,
					uploaded_at: ctx.now(),
					trashed_at: null,
				})
				.execute();
			await adopt(ctx.db, input.original, input.web);
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
			"Rename a file in the media library, or put it in a folder (null is the top level), or both at once. Its extension stays. Alt text and captions are not here: they belong to the entries that use it.",
		input: z.object({ id: z.string(), name: z.string().optional(), folder: z.string().nullable().optional() }),
		touches: (input) => [...(input.folder ? [folderRef(input.folder)] : []), mediaRef(input.id)],
		async preview(input, ctx) {
			const folder = input.folder ? (await checkMediaFolder(ctx.db, input.folder)).name : null;
			return {
				summary:
					input.name === undefined ? moveMessage(1, folder) : { key: "media.update", values: { name: input.name } },
				changes: [mediaRef(input.id)],
			};
		},
		async check(input, ctx) {
			const row = await liveRowOf(ctx.db, input.id);
			if (input.name !== undefined) cleanName(input.name, splitName(row.name).extension);
			if (input.folder) await checkMediaFolder(ctx.db, input.folder);
		},
		async run(input, ctx): Promise<MediaItem> {
			const row = await liveRowOf(ctx.db, input.id);
			await ctx.db
				.updateTable("media")
				.set((eb) => ({
					...(input.name === undefined ? {} : { name: cleanName(input.name, splitName(row.name).extension) }),
					...(input.folder === undefined ? {} : { folder_id: input.folder }),
					version: eb("version", "+", 1),
				}))
				.where("id", "=", input.id)
				.execute();
			return liveItem(ctx, input.id);
		},
		summary: (input, output) =>
			input.name === undefined
				? moveMessage(1, output.folderId === null ? null : (output.path.at(-1) ?? null))
				: { key: "media.update", values: { name: output.name } },
	}),
	defineOperation({
		name: "media.replace",
		kind: "write",
		humanOnly: true,
		description:
			"Replace a file's bytes with a new upload: every place that uses it now shows the new file, with its alt text and caption unchanged. Only a person replaces a file. The preview counts the uses.",
		input: z.object({ id: z.string(), original: Original, web: Web.optional(), placeholder: Placeholder.optional() }),
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
			// The file it had leaves the storage once the pages that still name it have had time to change (doc 11).
			await loosen(ctx.db, [row.original_key, ...(row.web_key ? [row.web_key] : [])], looseUntil(ctx.now()));
			await adopt(ctx.db, input.original, input.web);
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
					placeholder: kindOf(stat.mime) === "image" ? (input.placeholder ?? null) : null,
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
				const { values } = translatedFields(schema, entry.collection, entry, await followedFields(ctx.db, source));
				const fields = schema.collections[entry.collection]?.fields ?? {};
				for (const gap of await altGaps(ctx.db, fields, values, await bodyAsRead(ctx.db, source, entry.doc)))
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
