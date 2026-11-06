import { type Kysely, sql, type Transaction } from "kysely";
import { z } from "zod";
import { randomUUID } from "../bytes";
import type { Database } from "../db/schema";
import { publicPath } from "../entries/paths";
import { CheckError } from "../errors";
import { defineOperation, type Message, type OperationContext, type RecordRef } from "../operation";
import { defineRecordKind } from "../records";

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
};

/** A folder for the engine: its row, so undoing a removal or a rename puts it back. */
export const folderRecord = defineRecordKind({
	kind: "folder",
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
		const row = data as Row;
		const values = {
			collection: row.collection,
			parent_id: row.parent_id,
			name: row.name,
			position: row.position,
			trashed_at: row.trashed_at === null ? null : new Date(row.trashed_at),
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

async function folderOf(db: Db, id: string): Promise<Row> {
	const row = await db.selectFrom("folders").selectAll().where("id", "=", id).executeTakeFirst();
	if (!row || row.trashed_at) throw new CheckError({ key: "folders.unknown", values: { id } });
	return row;
}

/** The folder and every folder under it, not in the trash. */
async function subtree(db: Db, id: string): Promise<string[]> {
	const { rows } = await sql<{ id: string }>`
		with recursive tree as (
			select id from folders where id = ${id} and trashed_at is null
			union all
			select f.id from folders f join tree on f.parent_id = tree.id where f.trashed_at is null
		) select id from tree`.execute(db);
	return rows.map((row) => row.id);
}

/** `name`, or `name 2`, `name 3` … : the first that no sibling (but `self`) has (doc 07). */
async function freeName(db: Db, collection: string | null, parentId: string | null, name: string, self?: string) {
	let query = db.selectFrom("folders").select("name").where("trashed_at", "is", null);
	query = collection === null ? query.where("collection", "is", null) : query.where("collection", "=", collection);
	query = parentId === null ? query.where("parent_id", "is", null) : query.where("parent_id", "=", parentId);
	if (self) query = query.where("id", "!=", self);
	const taken = new Set((await query.execute()).map((row) => row.name));
	if (!taken.has(name)) return name;
	for (let n = 2; ; n++) if (!taken.has(`${name} ${n}`)) return `${name} ${n}`;
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

/** The entries of the translation groups that hold `ids`, not in the trash: a folder holds a group, never one language of it (principle 3). */
async function groupsOf(db: Db, ids: string[]) {
	if (ids.length === 0) return [];
	return db
		.selectFrom("entries")
		.select(["id", "collection", "translation_group", "folder_id", "version"])
		.where("trashed_at", "is", null)
		.where("translation_group", "in", db.selectFrom("entries").select("translation_group").where("id", "in", ids))
		.execute();
}

/** The entries in these folders, not in the trash. */
async function entriesIn(db: Db, folderIds: string[]) {
	if (folderIds.length === 0) return [];
	return db
		.selectFrom("entries")
		.select(["id", "collection", "locale", "status", "version"])
		.where("folder_id", "in", folderIds)
		.where("trashed_at", "is", null)
		.execute();
}

/** What removing a folder takes with it. */
async function removal(db: Db, id: string) {
	const folders = await subtree(db, id);
	const entries = await entriesIn(db, folders);
	const published = await (entries.length === 0
		? []
		: db
				.selectFrom("entry_published")
				.select("entry_id")
				.where(
					"entry_id",
					"in",
					entries.map((entry) => entry.id),
				)
				.execute());
	return { folders, entries, published: new Set(published.map((row) => row.entry_id)) };
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
			// Entries count by translation group: the list shows one row per group (doc 06).
			const own = new Map<string, number>();
			if (collection !== null)
				for (const row of await ctx.db
					.selectFrom("entries")
					.select(["folder_id", (eb) => eb.fn.count<number>(eb.fn("distinct", ["translation_group"])).as("count")])
					.where("collection", "=", collection)
					.where("trashed_at", "is", null)
					.where("folder_id", "is not", null)
					.groupBy("folder_id")
					.execute())
					if (row.folder_id) own.set(row.folder_id, Number(row.count));
			const children = new Map<string | null, Row[]>();
			for (const row of rows) children.set(row.parent_id, [...(children.get(row.parent_id) ?? []), row]);
			const folders: FolderNode[] = [];
			const walk = (parentId: string | null, depth: number): number => {
				let total = 0;
				for (const row of children.get(parentId) ?? []) {
					const node: FolderNode = {
						id: row.id,
						parentId: row.parent_id,
						name: row.name,
						depth,
						count: 0,
						version: row.version,
					};
					folders.push(node);
					node.count = (own.get(row.id) ?? 0) + walk(row.id, depth + 1);
					total += node.count;
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
		summary: (_input, output) => ({ key: "folders.create", values: { name: output.name } }),
	}),
	defineOperation({
		name: "folders.rename",
		kind: "write",
		description: "Rename a folder. Its siblings' names are taken.",
		input: z.object({ id: z.string(), name: z.string().trim().min(1) }),
		touches: (input) => [folderRef(input.id)],
		async check(input, ctx) {
			const folder = await folderOf(ctx.db, input.id);
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
		summary: (input) => ({ key: "folders.rename", values: { name: input.name } }),
	}),
	defineOperation({
		name: "folders.move",
		kind: "write",
		description:
			"Move a folder, with everything in it, to the top level (`parentId` null) or into another folder of the same collection. Not into itself or its own subfolders. The entries' addresses do not change.",
		input: z.object({ id: z.string(), parentId: z.string().nullable() }),
		touches: (input) => [folderRef(input.id)],
		async check(input, ctx) {
			const folder = await folderOf(ctx.db, input.id);
			await checkParent(ctx.db, folder.collection, input.parentId);
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
		summary: (_input, output) => ({ key: "folders.move", values: { name: output.name } }),
	}),
	defineOperation({
		name: "folders.remove",
		kind: "write",
		description:
			"Put a folder in the trash with its subfolders and everything in them. Read the preview first: it counts the entries, subfolders and published entries; the published ones go off the site. The trash can restore them for 30 days.",
		input: z.object({ id: z.string() }),
		async touches(input, ctx) {
			const { folders, entries } = await removal(ctx.db, input.id);
			return [...folders.map(folderRef), ...entries.map((entry) => entryRef(entry.id))];
		},
		async check(input, ctx) {
			await folderOf(ctx.db, input.id);
		},
		async preview(input, ctx) {
			const folder = await folderOf(ctx.db, input.id);
			const { folders, entries, published } = await removal(ctx.db, input.id);
			return {
				summary: {
					key: "folders.removePreview",
					values: {
						name: folder.name,
						entries: entries.length,
						folders: folders.length - 1,
						published: published.size,
					},
				},
				changes: [...folders.map(folderRef), ...entries.map((entry) => entryRef(entry.id))],
			};
		},
		async run(input, ctx) {
			const folder = await folderOf(ctx.db, input.id);
			const { folders, entries, published } = await removal(ctx.db, input.id);
			const now = ctx.now();
			await ctx.db
				.updateTable("folders")
				.set((eb) => ({ trashed_at: now, version: eb("version", "+", 1) }))
				.where("id", "in", folders)
				.execute();
			for (const entry of entries) {
				const wasPublished = published.has(entry.id);
				// A published entry goes off the site with its folder (07-3); it comes back from the trash as a draft (doc 11).
				let slug: string | null = null;
				if (wasPublished) {
					const copy = await ctx.db
						.selectFrom("entry_published")
						.select("slug")
						.where("entry_id", "=", entry.id)
						.executeTakeFirst();
					slug = copy?.slug ?? null;
					await ctx.db.deleteFrom("entry_published").where("entry_id", "=", entry.id).execute();
				}
				await ctx.db
					.updateTable("entries")
					.set((eb) => ({
						trashed_at: now,
						version: eb("version", "+", 1),
						...(wasPublished ? { status: "draft" as const, has_unpublished_changes: false } : {}),
					}))
					.where("id", "=", entry.id)
					.execute();
				if (slug !== null)
					ctx.emit({
						type: "entry.unpublished",
						ids: [entry.id],
						collection: entry.collection,
						locale: entry.locale,
						paths: [publicPath(ctx.site.schema(), entry.collection, slug) ?? []].flat(),
					});
			}
			return { id: folder.id, name: folder.name, entries: entries.length, unpublished: published.size };
		},
		summary: (_input, output) => ({
			key: "folders.remove",
			values: { name: output.name, entries: output.entries },
		}),
	}),
	defineOperation({
		name: "entries.moveToFolder",
		kind: "write",
		description:
			"Move entries into a folder of their collection, or to the top level with `folder` null. A translation group moves whole. Addresses and publish states stay as they are.",
		input: z.object({ ids: z.array(z.string()).min(1), folder: z.string().nullable() }),
		async touches(input, ctx) {
			return (await groupsOf(ctx.db, input.ids)).map((entry) => entryRef(entry.id));
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
		summary: (_input, output) => moveMessage(output.moved, output.name),
	}),
];
