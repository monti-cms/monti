import { MontiError } from "../../engine/errors";
import type { CollectionSchema, ReadContext, WriteContext } from "../../engine/types";
import type { Doc } from "../../rich-text/types";
import { validateDoc } from "../../rich-text/validate-doc";
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

/** Rejects a slug another active entry of the same collection and locale has; `id` is the entry itself, left out. */
export async function rejectTakenSlug(ctx: WriteContext, entry: SlugOwner): Promise<void> {
	const taken = await ctx.db
		.selectFrom("entries")
		.select("id")
		.where("id", "<>", entry.id)
		.where("collection", "=", entry.collection)
		.where("locale", "=", entry.locale)
		.where("slug", "=", entry.slug)
		.where("trashed_at", "is", null)
		.executeTakeFirst();
	if (taken !== undefined)
		throw new MontiError("CONFLICT", "An active entry of this collection and locale has this slug");
}

/** The body checked against the config's blocks and marks; rejects it with every problem in `details`. */
function docOf(body: unknown, ctx: ReadContext): Doc {
	const issues = validateDoc(body, ctx.config);
	if (issues.length > 0) throw new MontiError("BAD_REQUEST", "The body is not a valid document", issues);
	return body as Doc;
}

/** Rejects relation ids that are not active source entries of the collection each field points to. */
async function rejectRelations(ctx: WriteContext, collection: CollectionSchema, fields: Record<string, unknown>) {
	const targets = new Map<string, Set<string>>();
	for (const { field, value } of entryFieldValues(collection.fields, fields)) {
		if (field.type !== "relation") continue;
		const ids = targets.get(field.to) ?? new Set();
		for (const id of [value].flat() as string[]) ids.add(id.toLowerCase());
		targets.set(field.to, ids);
	}
	for (const [to, ids] of targets) await rejectInactiveSources(ctx, to, [...ids]);
}

async function rejectInactiveSources(ctx: WriteContext, collection: string, ids: string[]): Promise<void> {
	// `in ()` is not SQL: an empty `many` list points to nothing.
	if (ids.length === 0) return;
	const found = await ctx.db
		.selectFrom("entries")
		.select("id")
		.where("id", "in", ids)
		.where("collection", "=", collection)
		.where("source_entry_id", "is", null)
		.where("trashed_at", "is", null)
		.execute();
	if (found.length !== ids.length) {
		throw new MontiError(
			"BAD_REQUEST",
			`A relation points to an entry that is not an active ${collection} source entry`,
		);
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
