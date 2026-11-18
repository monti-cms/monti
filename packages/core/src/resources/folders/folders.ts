import { randomUUID } from "node:crypto";
import { z } from "zod";
import { MontiError } from "../../engine/errors";
import { defineRead, defineWrite } from "../../engine/operation";
import type { ReadContext, WriteContext } from "../../engine/types";

/** What the folder actions return of a folder. */
interface Folder {
	id: string;
	scope: string;
	name: string;
	parent_id: string | null;
}

const SHOWN = ["id", "scope", "name", "parent_id"] as const;

const listInput = z.object({ scope: z.string() });

async function listFolders(input: z.infer<typeof listInput>, ctx: ReadContext): Promise<Folder[]> {
	return ctx.db
		.selectFrom("folders")
		.select(SHOWN)
		.where("scope", "=", input.scope)
		.where("trashed_at", "is", null)
		.execute();
}

const createInput = z.object({
	id: z.uuid().optional(),
	scope: z.string(),
	name: z.string(),
	parent_id: z.uuid().nullable().optional(),
});

/** Makes a folder in `"media"` or a schema collection, under an active folder of the same scope when given one. */
async function createFolder(input: z.infer<typeof createInput>, ctx: WriteContext): Promise<Folder> {
	if (input.scope !== "media" && !Object.hasOwn(ctx.schema.collections, input.scope)) {
		throw new MontiError("BAD_REQUEST", `No collection or media has the scope "${input.scope}"`);
	}
	const folder = {
		id: input.id ?? randomUUID(),
		scope: input.scope,
		name: input.name,
		parent_id: input.parent_id ?? null,
	};
	if (folder.parent_id !== null) await rejectParent(ctx, folder.parent_id, folder.scope);
	await ctx.db.insertInto("folders").values(folder).execute();
	return folder;
}

/** Rejects a parent that is not an active folder of `scope`. */
async function rejectParent(ctx: WriteContext, parentId: string, scope: string): Promise<void> {
	const parent = await ctx.db
		.selectFrom("folders")
		.select("id")
		.where("id", "=", parentId)
		.where("scope", "=", scope)
		.where("trashed_at", "is", null)
		.executeTakeFirst();
	if (parent === undefined) throw new MontiError("BAD_REQUEST", "The parent is not an active folder of this scope");
}

const updateInput = z.object({ id: z.uuid(), name: z.string().optional(), parent_id: z.uuid().nullable().optional() });

/** Renames an active folder or moves it; a null `parent_id` moves it to the root, an omitted one keeps its parent. */
async function updateFolder(input: z.infer<typeof updateInput>, ctx: WriteContext): Promise<Folder> {
	const target = await ctx.db
		.selectFrom("folders")
		.select("scope")
		.where("id", "=", input.id)
		.where("trashed_at", "is", null)
		.executeTakeFirst();
	if (target === undefined) throw new MontiError("NOT_FOUND", "No active folder has this id");
	if (typeof input.parent_id === "string") {
		await rejectParent(ctx, input.parent_id, target.scope);
		await rejectCycle(ctx, input.id, input.parent_id);
	}
	return ctx.db
		.updateTable("folders")
		.set({ name: input.name, parent_id: input.parent_id })
		.where("id", "=", input.id)
		.returning(SHOWN)
		.executeTakeFirstOrThrow();
}

/** Rejects a move under the folder itself or one of its descendants: `id` among the new parent's ancestors, itself included. */
async function rejectCycle(ctx: WriteContext, id: string, parentId: string): Promise<void> {
	const reached = await ctx.db
		.withRecursive("ancestors(id, parent_id)", (db) =>
			db
				.selectFrom("folders")
				.select(["id", "parent_id"])
				.where("id", "=", parentId)
				.union((up) =>
					up
						.selectFrom("folders")
						.innerJoin("ancestors", "ancestors.parent_id", "folders.id")
						.select(["folders.id", "folders.parent_id"]),
				),
		)
		.selectFrom("ancestors")
		.select("id")
		.where("id", "=", id)
		.executeTakeFirst();
	if (reached !== undefined)
		throw new MontiError("BAD_REQUEST", "A folder cannot move under itself or its descendants");
}

/** The `folders` resource: folder trees of the collections and of the media. */
export const folders = {
	list: defineRead({ input: listInput, run: listFolders }),
	create: defineWrite({ input: createInput, run: createFolder }),
	update: defineWrite({ input: updateInput, run: updateFolder }),
};
