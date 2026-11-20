import { z } from "zod";
import { MontiError } from "../../engine/errors";
import type { FieldSchema, WriteContext } from "../../engine/types";
import { timestampInput, uuidInput } from "../_shared/input";
import { rejectInactiveEntryMedia } from "../media/uses";
import type { ConditionalValue } from "./fields";
import { type Entry, entryView, findEntry } from "./query";
import { checkData, collectionOf } from "./validate";

export const publishInput = z.object({
	id: uuidInput,
	locale: z.string().optional(),
	published_at: timestampInput.optional(),
});

export const unpublishInput = z.object({ id: uuidInput, locale: z.string().optional() });

/** Whether a stored value counts as not filled in: left out, an empty string or an empty list; `0` and `false` count. */
function isEmpty(value: unknown): boolean {
	return value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

/** The paths of the required fields `values` leaves empty, a chosen option's required sub-fields included. */
function emptyRequired(
	fields: Record<string, FieldSchema>,
	values: Record<string, unknown>,
	prefix = "fields",
): string[] {
	return Object.entries(fields).flatMap(([key, field]) => {
		const value = values[key];
		const path = `${prefix}.${key}`;
		if (isEmpty(value)) return field.required ? [path] : [];
		if (field.type !== "conditional") return [];
		const chosen = value as ConditionalValue;
		return emptyRequired(field.options[chosen.option].fields, chosen.fields, `${path}.fields`);
	});
}

/**
 * Rejects a working copy a save would reject now: fields, body, relation targets and media checked against the schema,
 * config and references of this moment. A value of a field the schema no longer has is not checked, and what is
 * published stays the stored `data`, that value included.
 */
async function rejectStaleData(ctx: WriteContext, entry: Entry): Promise<void> {
	const collection = collectionOf(ctx, entry.collection);
	const data = await checkData(ctx, collection, entry.data, "drop");
	await rejectInactiveEntryMedia(ctx, collection, data);
}

/** Rejects a working copy that leaves a required field empty. */
function rejectEmptyRequired(ctx: WriteContext, entry: Entry): void {
	const empty = emptyRequired(collectionOf(ctx, entry.collection).fields, entry.data.fields as Record<string, unknown>);
	if (empty.length > 0) throw new MontiError("BAD_REQUEST", `Required fields are empty: ${empty.join(", ")}`);
}

/** Rejects a slug another active entry of the same collection and locale is published with. */
async function rejectPublishedSlug(ctx: WriteContext, entry: Entry): Promise<void> {
	const taken = await entryView(ctx, false)
		.where("entry.id", "<>", entry.id)
		.where("entry.collection", "=", entry.collection)
		.where("entry.locale", "=", entry.locale)
		.where("entry.slug", "=", entry.slug)
		.executeTakeFirst();
	if (taken !== undefined) throw new MontiError("CONFLICT", "Another entry is published with this slug");
}

/**
 * Saves an active entry's working copy in `locale` (its source locale when left out) as its published copy in that locale.
 * `published_at` left out is now on the first publish and the time already published at after that.
 */
export async function publishEntry(input: z.infer<typeof publishInput>, ctx: WriteContext): Promise<Entry> {
	const entry = await findEntry(ctx, { id: input.id, locale: input.locale }, true);
	// Before the required check, which walks the chosen options and needs data that matches the schema.
	await rejectStaleData(ctx, entry);
	rejectEmptyRequired(ctx, entry);
	await rejectPublishedSlug(ctx, entry);
	const published = {
		slug: entry.slug,
		data: JSON.stringify(entry.data),
		published_at: input.published_at === undefined ? (entry.published_at ?? new Date()) : new Date(input.published_at),
	};
	await ctx.db
		.insertInto("entry_published")
		.values({ entry_id: entry.id, locale: entry.locale, ...published })
		.onConflict((conflict) => conflict.columns(["entry_id", "locale"]).doUpdateSet(published))
		.execute();
	return findEntry(ctx, { id: entry.id, locale: entry.locale }, false);
}

/** Deletes an active entry's published copy in `locale` (its source locale when left out), if it has one, and returns its working copy. */
export async function unpublishEntry(input: z.infer<typeof unpublishInput>, ctx: WriteContext): Promise<Entry> {
	const entry = await findEntry(ctx, { id: input.id, locale: input.locale }, true);
	await ctx.db
		.deleteFrom("entry_published")
		.where("entry_id", "=", entry.id)
		.where("locale", "=", entry.locale)
		.execute();
	return { ...entry, published_at: null };
}
