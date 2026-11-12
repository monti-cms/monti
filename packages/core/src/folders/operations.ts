import { type Kysely, sql, type Transaction } from "kysely";
import { z } from "zod";
import { entryPlace, folderLog, folderPlace, recordsOf } from "../activity/words";
import { randomUUID } from "../bytes";
import type { Database, TrashedBy } from "../db/schema";
import { CheckError } from "../errors";
import { usedOf } from "../media/uses";
import { defineOperation, type Message, type OperationContext, type RecordRef } from "../operation";
import { defineRecordKind, lockRecords } from "../records";

type Db = Kysely<Database> | Transaction<Database>;

/** Whose folders: a collection's entries, or the media library's files (doc 07, principle 2: one shape for both). */
const Scope = z.union([z.object({ collection: z.string() }), z.literal("media")]);
type Scope = z.infer<typeof Scope>;

const collectionOf = (scope: Scope) => (scope === "media" ? null : scope.collection);

/** A folder in a tree, with how many items it holds with its subfolders (trash left out) and how deep it sits. */
export type FolderNode = {
	id: string;
	parentId: string | null;
	name: string;
	depth: number;
	count: number;
	/** How many of them are on the site: removing the folder takes them off it, so the screen asks first (flow 5·05). */
	published: number;
	version: number;
};

/** "Moved 3 to 2024", or to the top level. */
const moveMessage = (count: number, name: string | null): Message =>
	name === null
		? { key: "entries.moveToTop", values: { count } }
		: { key: "entries.moveToFolder", values: { count, name } };

const folderRef = (id: string): RecordRef => ({ kind: "folder", id });
const entryRef = (id: string): RecordRef => ({ kind: "entry", id });

type Row = {
	id: string;
	collection: string | null;
	parent_id: string | null;
	name: string;
	position: number;
	version: number;
	created_at: Date;
	trashed_at: Date | null;
	trashed_by: TrashedBy | null;
};

const DateShape = z.union([z.date(), z.iso.datetime().transform((value) => new Date(value))]);
const RowShape: z.ZodType<Row> = z.object({
	id: z.string(),
	collection: z.string().nullable(),
	parent_id: z.string().nullable(),
	name: z.string(),
	position: z.number(),
	version: z.number().int(),
	created_at: DateShape,
	trashed_at: DateShape.nullable(),
	trashed_by: z.enum(["admin", "assistant", "cli", "plugin"]).nullable(),
});

/** A folder for the engine: its row, so undoing a removal or a rename puts it back. */
export const folderRecord = defineRecordKind({
	kind: "folder",
	label(data) {
		const row = data as Row;
		return { title: row.name, ...(row.collection === null ? {} : { collection: row.collection }) };
	},
	async load(db, ids) {
		if (ids.length === 0) return [];
		const rows = await db.selectFrom("folders").selectAll().where("id", "in", ids).execute();
		return rows.map((row) => ({ id: row.id, version: row.version, data: row }));
	},
	async restore(db, id, data) {
		if (data === null) {
			await db.deleteFrom("folders").where("id", "=", id).execute();
			return;
		}
		const row = RowShape.parse(data);
		const values = {
			collection: row.collection,
			parent_id: row.parent_id,
			name: row.name,
			position: row.position,
			trashed_at: row.trashed_at === null ? null : new Date(row.trashed_at),
			trashed_by: row.trashed_by,
		};
		await db
			.insertInto("folders")
			.values({ id, ...values, created_at: new Date(row.created_at), version: row.version + 1 })
			.onConflict((conflict) =>
				conflict.column("id").doUpdateSet((eb) => ({ ...values, version: eb("folders.version", "+", 1) })),
			)
			.execute();
	},
});

export async function folderOf(db: Db, id: string): Promise<Row> {
	const row = await db.selectFrom("folders").selectAll().where("id", "=", id).executeTakeFirst();
	if (!row || row.trashed_at) throw new CheckError({ key: "folders.unknown", values: { id } });
	return row;
}

/** The folder and every folder under it, not in the trash. */
export async function subtree(db: Db, id: string): Promise<string[]> {
	const { rows } = await sql<{ id: string }>`
		with recursive tree as (
			select id from folders where id = ${id} and trashed_at is null
			union all
			select f.id from folders f join tree on f.parent_id = tree.id where f.trashed_at is null
		) select id from tree`.execute(db);
	return rows.map((row) => row.id);
}

/** `name`, or `name 2`, `name 3` … : the first that no sibling (but `self`) has (doc 07). */
export async function freeName(
	db: Db,
	collection: string | null,
	parentId: string | null,
	name: string,
	self?: string,
) {
	let query = db.selectFrom("folders").select("name").where("trashed_at", "is", null);
	query = collection === null ? query.where("collection", "is", null) : query.where("collection", "=", collection);
	query = parentId === null ? query.where("parent_id", "is", null) : query.where("parent_id", "=", parentId);
	if (self) query = query.where("id", "!=", self);
	const taken = new Set((await query.execute()).map((row) => row.name));
	if (!taken.has(name)) return name;
	for (let n = 2; ; n++) if (!taken.has(`${name} ${n}`)) return `${name} ${n}`;
}

/** What `lockFolderScope` locks: one sibling list, by its collection (the media library has none) and the folder it is in. */
export const folderScopeKey = (collection: string | null, parentId: string | null) =>
	`monti:folders:${collection ?? "media"}:${parentId ?? "root"}`;

/** Serializes name and position choices within one sibling list. */
export async function lockFolderScope(db: Db, collection: string | null, parentId: string | null): Promise<void> {
	await sql`select pg_advisory_xact_lock(hashtext(${folderScopeKey(collection, parentId)}))`.execute(db);
}

function checkScope(ctx: OperationContext, scope: Scope) {
	const collection = collectionOf(scope);
	if (collection !== null && !ctx.site.schema().collections[collection])
		throw new CheckError({ key: "collections.unknown", values: { collection } });
}

/** A parent folder given for a new place: it exists in the same scope and is not in the trash. */
async function checkParent(db: Db, collection: string | null, parentId: string | null) {
	if (parentId === null) return;
	const parent = await folderOf(db, parentId);
	if (parent.collection !== collection) throw new CheckError({ key: "folders.otherScope" });
}

/**
 * The entries of the translation groups that hold the live ones of `ids`: a folder holds a group, never one language of it (principle 3). A language of the
 * group that is in the trash moves too, so the trash never shows, deletes or brings back one entry out of two folders (doc 11).
 */
async function groupsOf(db: Db, ids: string[]) {
	if (ids.length === 0) return [];
	return db
		.selectFrom("entries")
		.select(["id", "collection", "translation_group", "folder_id", "version"])
		.where(
			"translation_group",
			"in",
			db.selectFrom("entries").select("translation_group").where("id", "in", ids).where("trashed_at", "is", null),
		)
		.execute();
}

/**
 * What removing a media folder does (doc 09): files nobody uses go, files in use stay, and so do the folders holding them, up to the removed one. It asks nothing:
 * a media folder takes nothing off the site.
 */
export async function mediaRemoval(db: Db, id: string) {
	const folders = await subtree(db, id);
	const files = await db
		.selectFrom("media")
		.select(["id", "folder_id"])
		.where("folder_id", "in", folders)
		.where("trashed_at", "is", null)
		.execute();
	const used = await usedOf(
		db,
		files.map((file) => file.id),
	);
	const rows = await db.selectFrom("folders").select(["id", "parent_id"]).where("id", "in", folders).execute();
	const parentOf = new Map(rows.map((row) => [row.id, row.parent_id]));
	const staying = new Set<string>();
	for (const file of files) {
		if (!used.has(file.id)) continue;
		for (let at = file.folder_id; at && parentOf.has(at); at = parentOf.get(at) ?? null) staying.add(at);
	}
	return {
		folders,
		files: files.map((file) => file.id),
		moved: files.filter((file) => !used.has(file.id)).map((file) => file.id),
		used,
		gone: folders.filter((folder) => !staying.has(folder)),
	};
}

export const folderOperations = [
	defineOperation({
		name: "folders.tree",
		kind: "read",
		description:
			"The folders of a collection (or of the media library) as a tree, in order, each with how many entries it holds counting its subfolders. Folders sort things in the admin only; the site never sees them.",
		input: z.object({ scope: Scope }),
		async run(input, ctx): Promise<{ folders: FolderNode[] }> {
			const collection = collectionOf(input.scope);
			let query = ctx.db.selectFrom("folders").selectAll().where("trashed_at", "is", null);
			query = collection === null ? query.where("collection", "is", null) : query.where("collection", "=", collection);
			const rows = await query.orderBy("position").orderBy("name").execute();
			// Entries count by translation group: the list shows one row per group (doc 06). Media counts its files.
			const own = new Map<string, { count: number; published: number }>();
			if (collection === null) {
				for (const row of await ctx.db
					.selectFrom("media")
					.select(["folder_id", sql<number>`count(*)::int`.as("count")])
					.where("trashed_at", "is", null)
					.where("folder_id", "is not", null)
					.groupBy("folder_id")
					.execute())
					if (row.folder_id) own.set(row.folder_id, { count: Number(row.count), published: 0 });
			} else {
				for (const row of await ctx.db
					.selectFrom("entries")
					.leftJoin("entry_published", "entry_published.entry_id", "entries.id")
					.select((eb) => [
						"entries.folder_id",
						eb.fn.count<number>(eb.fn("distinct", ["entries.translation_group"])).as("count"),
						eb.fn.count<number>("entry_published.entry_id").as("published"),
					])
					.where("entries.collection", "=", collection)
					.where("entries.trashed_at", "is", null)
					.where("entries.folder_id", "is not", null)
					.groupBy("entries.folder_id")
					.execute())
					if (row.folder_id) own.set(row.folder_id, { count: Number(row.count), published: Number(row.published) });
			}
			const children = new Map<string | null, Row[]>();
			for (const row of rows) children.set(row.parent_id, [...(children.get(row.parent_id) ?? []), row]);
			const folders: FolderNode[] = [];
			const walk = (parentId: string | null, depth: number) => {
				const total = { count: 0, published: 0 };
				for (const row of children.get(parentId) ?? []) {
					const node: FolderNode = {
						id: row.id,
						parentId: row.parent_id,
						name: row.name,
						depth,
						count: 0,
						published: 0,
						version: row.version,
					};
					folders.push(node);
					const inside = walk(row.id, depth + 1);
					node.count = (own.get(row.id)?.count ?? 0) + inside.count;
					node.published = (own.get(row.id)?.published ?? 0) + inside.published;
					total.count += node.count;
					total.published += node.published;
				}
				return total;
			};
			walk(null, 0);
			return { folders };
		},
	}),
	defineOperation({
		name: "folders.create",
		kind: "write",
		description:
			"Make a folder at the top level (`parentId` null) or inside another. A name a sibling has gets ' 2'. Returns its id, which a later item of the same proposal can point at.",
		input: z.object({ scope: Scope, parentId: z.string().nullable(), name: z.string().trim().min(1) }),
		async check(input, ctx) {
			checkScope(ctx, input.scope);
			await checkParent(ctx.db, collectionOf(input.scope), input.parentId);
			await lockFolderScope(ctx.db, collectionOf(input.scope), input.parentId);
		},
		preview: (input) => ({ summary: { key: "folders.create", values: { name: input.name } }, changes: [] }),
		async run(input, ctx) {
			const collection = collectionOf(input.scope);
			const name = await freeName(ctx.db, collection, input.parentId, input.name);
			const id = randomUUID();
			let siblings = ctx.db.selectFrom("folders").select((eb) => eb.fn.max("position").as("position"));
			siblings =
				collection === null ? siblings.where("collection", "is", null) : siblings.where("collection", "=", collection);
			siblings =
				input.parentId === null
					? siblings.where("parent_id", "is", null)
					: siblings.where("parent_id", "=", input.parentId);
			const last = await siblings.executeTakeFirst();
			await ctx.db
				.insertInto("folders")
				.values({ id, collection, parent_id: input.parentId, name, position: Number(last?.position ?? -1) + 1 })
				.execute();
			ctx.created(folderRef(id));
			return { id, name };
		},
		log: folderLog,
		summary: (_input, output) => ({ key: "folders.create", values: { name: output.name } }),
		where: (_input, _output, records) => folderPlace(records),
	}),
	defineOperation({
		name: "folders.rename",
		kind: "write",
		description: "Rename a folder. Its siblings' names are taken.",
		input: z.object({ id: z.string(), name: z.string().trim().min(1) }),
		touches: (input) => [folderRef(input.id)],
		async check(input, ctx) {
			const folder = await folderOf(ctx.db, input.id);
			await lockFolderScope(ctx.db, folder.collection, folder.parent_id);
			if ((await freeName(ctx.db, folder.collection, folder.parent_id, input.name, folder.id)) !== input.name)
				throw new CheckError({ key: "folders.nameTaken", values: { name: input.name } });
		},
		preview: (input) => ({
			summary: { key: "folders.rename", values: { name: input.name } },
			changes: [folderRef(input.id)],
		}),
		async run(input, ctx) {
			await ctx.db
				.updateTable("folders")
				.set((eb) => ({ name: input.name, version: eb("version", "+", 1) }))
				.where("id", "=", input.id)
				.execute();
			return { id: input.id, name: input.name };
		},
		log: folderLog,
		summary: (input) => ({ key: "folders.rename", values: { name: input.name } }),
		where: (_input, _output, records) => folderPlace(records),
	}),
	defineOperation({
		name: "folders.move",
		kind: "write",
		description:
			"Move a folder, with everything in it, to the top level (`parentId` null) or into another folder of the same collection. Not into itself or its own subfolders. The entries' addresses do not change.",
		input: z.object({ id: z.string(), parentId: z.string().nullable() }),
		// The new parent's lock too: a folder being removed either sees this one come in, or refuses it.
		touches: (input) => [folderRef(input.id), ...(input.parentId ? [folderRef(input.parentId)] : [])],
		async check(input, ctx) {
			const folder = await folderOf(ctx.db, input.id);
			await checkParent(ctx.db, folder.collection, input.parentId);
			await lockFolderScope(ctx.db, folder.collection, input.parentId);
			if (input.parentId !== null && (await subtree(ctx.db, input.id)).includes(input.parentId))
				throw new CheckError({ key: "folders.intoItself" });
		},
		async preview(input, ctx) {
			const folder = await folderOf(ctx.db, input.id);
			return { summary: { key: "folders.move", values: { name: folder.name } }, changes: [folderRef(input.id)] };
		},
		async run(input, ctx) {
			const folder = await folderOf(ctx.db, input.id);
			const name = await freeName(ctx.db, folder.collection, input.parentId, folder.name, folder.id);
			await ctx.db
				.updateTable("folders")
				.set((eb) => ({ parent_id: input.parentId, name, version: eb("version", "+", 1) }))
				.where("id", "=", input.id)
				.execute();
			return { id: input.id, name };
		},
		log: folderLog,
		summary: (_input, output) => ({ key: "folders.move", values: { name: output.name } }),
		where: (_input, _output, records) => folderPlace(records),
	}),
	defineOperation({
		name: "entries.moveToFolder",
		kind: "write",
		description:
			"Move entries into a folder of their collection, or to the top level with `folder` null. A translation group moves whole. Addresses and publish states stay as they are.",
		input: z.object({ ids: z.array(z.string()).min(1), folder: z.string().nullable() }),
		// One by one: the assistant's proposal has an item per entry, each taken or left on its own (doc 10).
		each: "ids",
		// In a proposal it follows another change of the same entry as it is (it carries no version). What it changes is where the entry is.
		follows: (input) => input,
		places: (input) => input.ids.map((id) => `entry:${id}/folder`),
		async touches(input, ctx) {
			// The folder too, as a file's move takes its folder: a folder on its way to the trash and an entry on its way in go one after the other (doc 11).
			// It is held here, before the entries are: `trash.move` holds a folder before what is in it, and two writes that hold them in two orders stop each other.
			if (input.folder) await lockRecords(ctx.db, [folderRef(input.folder)]);
			return [
				...(input.folder ? [folderRef(input.folder)] : []),
				...(await groupsOf(ctx.db, input.ids)).map((entry) => entryRef(entry.id)),
			];
		},
		async check(input, ctx) {
			const entries = await groupsOf(ctx.db, input.ids);
			if (entries.length === 0) throw new CheckError({ key: "entries.unknown", values: { id: input.ids[0] ?? "" } });
			const collections = new Set(entries.map((entry) => entry.collection));
			if (input.folder === null) return;
			const folder = await folderOf(ctx.db, input.folder);
			if (collections.size > 1 || folder.collection !== [...collections][0])
				throw new CheckError({ key: "folders.otherScope" });
		},
		async preview(input, ctx) {
			const entries = await groupsOf(ctx.db, input.ids);
			// A folder an earlier item of the same proposal makes has no row yet (doc 07, agent): it is named as that.
			const target =
				input.folder === null
					? null
					: await ctx.db.selectFrom("folders").select("name").where("id", "=", input.folder).executeTakeFirst();
			const count = new Set(entries.map((entry) => entry.translation_group)).size;
			if (input.folder !== null && !target)
				return {
					summary: { key: "entries.moveToMadeFolder", values: { count } },
					changes: entries.map((entry) => entryRef(entry.id)),
				};
			const name = target?.name ?? null;
			return {
				summary: moveMessage(count, name),
				changes: entries.map((entry) => entryRef(entry.id)),
			};
		},
		async run(input, ctx) {
			const entries = (await groupsOf(ctx.db, input.ids)).filter((entry) => entry.folder_id !== input.folder);
			if (entries.length > 0)
				await ctx.db
					.updateTable("entries")
					.set((eb) => ({ folder_id: input.folder, version: eb("version", "+", 1) }))
					.where(
						"id",
						"in",
						entries.map((entry) => entry.id),
					)
					.execute();
			const name = input.folder === null ? null : (await folderOf(ctx.db, input.folder)).name;
			return { moved: new Set(entries.map((entry) => entry.translation_group)).size, folder: input.folder, name };
		},
		log: "save",
		summary: (_input, output) => moveMessage(output.moved, output.name),
		where: (_input, _output, records) => entryPlace(recordsOf(records, "entry")),
	}),
];
