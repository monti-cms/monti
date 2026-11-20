import { sql } from "kysely";
import type { z } from "zod";
import type { WriteContext } from "../../engine/types";
import type { deleteInput } from "./input";
import { findItem, listedItems, type TrashRef } from "./items";
import { anyOf, itemsOf, type Tree } from "./tree";

type DeleteInput = z.infer<typeof deleteInput>;

/** Deletes entries with their working and published copies and their `media_uses` rows. */
async function deleteEntries(ctx: WriteContext, ids: string[]): Promise<void> {
	await ctx.db
		.deleteFrom("media_uses")
		.where("source_kind", "=", "entry")
		.where("source_id", "=", anyOf(ids))
		.execute();
	await ctx.db.deleteFrom("entries").where("id", "=", anyOf(ids)).execute();
}

/** Deletes media with their `media_uses` rows; their files wait in `loose_files` for `removeLooseFiles`. */
async function deleteMedia(ctx: WriteContext, ids: string[]): Promise<void> {
	await ctx.db.deleteFrom("media_uses").where("media_id", "=", anyOf(ids)).execute();
	await ctx.db
		.insertInto("loose_files")
		.columns(["key", "remove_after"])
		.expression((eb) =>
			eb
				.selectFrom("media")
				.select(["key", sql<Date>`now()`.as("remove_after")])
				.where("id", "=", anyOf(ids)),
		)
		.execute();
	await ctx.db.deleteFrom("media").where("id", "=", anyOf(ids)).execute();
}

/** Deletes folders; what is still in them, trashed before them, stays in the trash at the root. */
async function deleteFolders(ctx: WriteContext, ids: string[]): Promise<void> {
	await ctx.db.updateTable("entries").set({ folder_id: null }).where("folder_id", "=", anyOf(ids)).execute();
	await ctx.db.updateTable("media").set({ folder_id: null }).where("folder_id", "=", anyOf(ids)).execute();
	await ctx.db.updateTable("folders").set({ parent_id: null }).where("parent_id", "=", anyOf(ids)).execute();
	await ctx.db.deleteFrom("folders").where("id", "=", anyOf(ids)).execute();
}

async function deleteTree(ctx: WriteContext, tree: Tree): Promise<void> {
	await deleteEntries(ctx, tree.entries);
	await deleteMedia(ctx, tree.media);
	await deleteFolders(ctx, tree.folders);
}

/** The trash items `ids` names; rejects them all when one is not a trash item. */
async function namedItems(ctx: WriteContext, ids: string[]): Promise<TrashRef[]> {
	const items: TrashRef[] = [];
	for (const id of new Set(ids)) {
		const { kind } = await findItem(ctx, id);
		items.push({ kind, id });
	}
	return items;
}

/** The items the input names: given by id, or the listed ones trashed before `before`, or all the listed ones. */
async function targetsOf(ctx: WriteContext, input: DeleteInput): Promise<TrashRef[]> {
	if ("id" in input) return namedItems(ctx, [input.id]);
	if ("ids" in input) return namedItems(ctx, input.ids);
	let query = listedItems(ctx).select(["item.kind", "item.id"]);
	// The time stays text: a JS `Date` would cut its microseconds off before the database compares it.
	if ("before" in input) query = query.where(sql<boolean>`item.trashed_at < ${input.before}::timestamptz`);
	return query.execute();
}

/** Deletes trash items for good, each with what went into the trash with it. */
export async function deleteItems(input: DeleteInput, ctx: WriteContext): Promise<TrashRef | TrashRef[]> {
	const items = await targetsOf(ctx, input);
	for (const item of items) await deleteTree(ctx, await itemsOf(ctx, item));
	return "id" in input ? items[0] : items;
}
