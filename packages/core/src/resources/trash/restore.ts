import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type { WriteContext } from "../../engine/types";
import { firstFree } from "../_shared/names";
import { freeSlug } from "../entries/duplicate";
import { activeChildren } from "../folders/folders";
import type { idInput } from "./input";
import { findItem, type TrashRef } from "./items";
import { anyOf, itemsOf } from "./tree";

/**
 * The active folder an item whose folder is `folderId` goes back into: that folder when it is active, else the active
 * folder of the same scope and name at the same place, made when there is none. A trashed folder stays in the trash.
 */
async function activeFolder(ctx: WriteContext, folderId: string | null): Promise<string | null> {
	if (folderId === null) return null;
	const folder = await ctx.db.selectFrom("folders").selectAll().where("id", "=", folderId).executeTakeFirstOrThrow();
	if (folder.trashed_at === null) return folderId;
	const parent_id = await activeFolder(ctx, folder.parent_id);
	const twin = await activeChildren(ctx, folder.scope, parent_id).where("name", "=", folder.name).executeTakeFirst();
	if (twin !== undefined) return twin.id;
	const id = randomUUID();
	await ctx.db.insertInto("folders").values({ id, scope: folder.scope, parent_id, name: folder.name }).execute();
	return id;
}

/** Takes an entry or media out of the trash into an active folder. */
async function untrash(ctx: WriteContext, table: "entries" | "media", id: string): Promise<void> {
	const row = await ctx.db.selectFrom(table).select("folder_id").where("id", "=", id).executeTakeFirstOrThrow();
	const folder_id = await activeFolder(ctx, row.folder_id);
	await ctx.db.updateTable(table).set({ trashed_at: null, folder_id }).where("id", "=", id).execute();
}

/** Brings an entry back as a draft: no published copy, and each working copy's slug numbered when an active entry has it. */
async function restoreEntry(ctx: WriteContext, id: string): Promise<void> {
	const { collection } = await ctx.db
		.selectFrom("entries")
		.select("collection")
		.where("id", "=", id)
		.executeTakeFirstOrThrow();
	const copies = await ctx.db
		.selectFrom("entry_locales")
		.select(["locale", "slug"])
		.where("entry_id", "=", id)
		.execute();
	for (const { locale, slug } of copies) {
		const free = await freeSlug(ctx, { collection, locale }, slug);
		await ctx.db
			.updateTable("entry_locales")
			.set({ slug: free })
			.where("entry_id", "=", id)
			.where("locale", "=", locale)
			.execute();
	}
	await ctx.db.deleteFrom("entry_published").where("entry_id", "=", id).execute();
	await untrash(ctx, "entries", id);
}

/** Puts a folder back into an active parent, its name numbered when an active folder there has it. */
async function placeFolder(ctx: WriteContext, id: string): Promise<void> {
	const folder = await ctx.db.selectFrom("folders").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
	const parent_id = await activeFolder(ctx, folder.parent_id);
	const siblings = await activeChildren(ctx, folder.scope, parent_id).execute();
	const name = firstFree(folder.name, new Set(siblings.map((sibling) => sibling.name)));
	await ctx.db.updateTable("folders").set({ parent_id, name }).where("id", "=", id).execute();
}

/** Brings a folder back with what went into the trash with it; what was trashed before it stays. */
async function restoreFolder(ctx: WriteContext, id: string): Promise<void> {
	const tree = await itemsOf(ctx, { kind: "folder", id });
	await placeFolder(ctx, id);
	await ctx.db.updateTable("folders").set({ trashed_at: null }).where("id", "=", anyOf(tree.folders)).execute();
	for (const entryId of tree.entries) await restoreEntry(ctx, entryId);
	await ctx.db.updateTable("media").set({ trashed_at: null }).where("id", "=", anyOf(tree.media)).execute();
}

async function restoreMedia(ctx: WriteContext, id: string): Promise<void> {
	await untrash(ctx, "media", id);
}

const RESTORE = { entry: restoreEntry, folder: restoreFolder, media: restoreMedia };

/** Takes a trash item out of the trash. */
export async function restoreItem(input: z.infer<typeof idInput>, ctx: WriteContext): Promise<TrashRef> {
	const { kind, id } = await findItem(ctx, input.id);
	await RESTORE[kind](ctx, id);
	return { kind, id };
}
