import { MontiError } from "../../engine/errors";
import type { CollectionSchema, ReadContext, WriteContext } from "../../engine/types";
import { docOf } from "../_shared/doc";
import { isActiveFolder } from "../folders/folders";
import { type EntryData, entryFieldValues } from "../media/uses";
import { fieldsSchema } from "./fields";

/** The `data` a write is given; `fields` left out means none. */
interface DataInput {
	fields?: Record<string, unknown>;
	body?: unknown;
}

/** What identifies an entry's slug: unique among the active entries of its collection and locale. */
interface SlugOwner {
	id: string;
	collection: string;
	locale: string;
	slug: string;
}

/** The schema of a collection; rejects a name the schema does not have. */
export function collectionOf(ctx: ReadContext, name: string): CollectionSchema {
	if (!Object.hasOwn(ctx.schema.collections, name)) {
		throw new MontiError("BAD_REQUEST", `No collection is named "${name}"`);
	}
	return ctx.schema.collections[name];
}

export function rejectLocale(ctx: ReadContext, locale: string): void {
	if (!ctx.schema.locales.includes(locale)) throw new MontiError("BAD_REQUEST", `No locale is named "${locale}"`);
}

/** Rejects a folder that is not an active folder of the entry's collection. */
export async function rejectFolder(ctx: WriteContext, folderId: string, collection: string): Promise<void> {
	if (!(await isActiveFolder(ctx, folderId, collection))) {
		throw new MontiError("BAD_REQUEST", "The folder is not an active folder of this collection");
	}
}

/** Rejects a slug another active entry of the same collection has in the same locale; `id` is the entry itself, left out. */
export async function rejectTakenSlug(ctx: WriteContext, entry: SlugOwner): Promise<void> {
	const taken = await ctx.db
		.selectFrom("entry_locales")
		.innerJoin("entries", "entries.id", "entry_locales.entry_id")
		.select("entries.id")
		.where("entries.id", "<>", entry.id)
		.where("entries.collection", "=", entry.collection)
		.where("entries.trashed_at", "is", null)
		.where("entry_locales.locale", "=", entry.locale)
		.where("entry_locales.slug", "=", entry.slug)
		.executeTakeFirst();
	if (taken !== undefined)
		throw new MontiError("CONFLICT", "An active entry of this collection and locale has this slug");
}

/** Rejects relation ids that are not active entries of the collection each field points to. */
async function rejectRelations(ctx: WriteContext, collection: CollectionSchema, fields: Record<string, unknown>) {
	const targets = new Map<string, Set<string>>();
	for (const { field, value } of entryFieldValues(collection.fields, fields)) {
		if (field.type !== "relation") continue;
		const ids = targets.get(field.to) ?? new Set();
		for (const id of [value].flat() as string[]) ids.add(id);
		targets.set(field.to, ids);
	}
	for (const [to, ids] of targets) await rejectInactiveTargets(ctx, to, [...ids]);
}

async function rejectInactiveTargets(ctx: WriteContext, collection: string, ids: string[]): Promise<void> {
	// `in ()` is not SQL: an empty `many` list points to nothing.
	if (ids.length === 0) return;
	const found = await ctx.db
		.selectFrom("entries")
		.select("id")
		.where("id", "in", ids)
		.where("collection", "=", collection)
		.where("trashed_at", "is", null)
		.execute();
	if (found.length !== ids.length) {
		throw new MontiError("BAD_REQUEST", `A relation points to an entry that is not an active ${collection} entry`);
	}
}

/** The data as stored, `{ fields, body? }`; rejects fields, a body or relations the collection does not accept. */
export async function checkData(ctx: WriteContext, collection: CollectionSchema, data: DataInput): Promise<EntryData> {
	const parsed = fieldsSchema(collection.fields).safeParse(data.fields ?? {});
	if (!parsed.success) {
		throw new MontiError("BAD_REQUEST", "The fields do not match the collection", parsed.error.issues);
	}
	const fields = parsed.data as Record<string, unknown>;
	await rejectRelations(ctx, collection, fields);
	if (data.body === undefined) return { fields };
	if (collection.body !== true) throw new MontiError("BAD_REQUEST", "This collection has no body");
	return { fields, body: docOf(data.body, ctx) };
}
