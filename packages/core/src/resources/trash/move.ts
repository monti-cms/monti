import { sql } from "kysely";
import type { z } from "zod";
import { MontiError } from "../../engine/errors";
import type { WriteContext } from "../../engine/types";
import type { idInput } from "./input";
import { allItems, type TrashRef } from "./items";
import { anyOf, itemsOf } from "./tree";

/** The database clock read once, as text so its microseconds survive the trip back. */
async function clock(ctx: WriteContext): Promise<string> {
	const { rows } = await sql<{ now: string }>`select clock_timestamp()::text as now`.execute(ctx.db);
	return rows[0].now;
}

/** Moves an active entry, folder or media to the trash; a folder takes its active subfolders, entries and media along at the same time. */
export async function moveItem(input: z.infer<typeof idInput>, ctx: WriteContext): Promise<TrashRef> {
	const item = await allItems(ctx)
		.select(["item.kind", "item.id"])
		.where("item.id", "=", input.id)
		.where("item.trashed_at", "is", null)
		.executeTakeFirst();
	if (item === undefined) throw new MontiError("NOT_FOUND", "No active entry, folder or media has this id");
	const tree = await itemsOf(ctx, item);
	const trashed_at = await clock(ctx);
	await ctx.db.updateTable("entries").set({ trashed_at }).where("id", "=", anyOf(tree.entries)).execute();
	await ctx.db.updateTable("media").set({ trashed_at }).where("id", "=", anyOf(tree.media)).execute();
	await ctx.db.updateTable("folders").set({ trashed_at }).where("id", "=", anyOf(tree.folders)).execute();
	return item;
}
