import type { Kysely, Transaction } from "kysely";
import { asDoc, type Block, type Doc } from "../body/doc";
import type { Database } from "../db/schema";
import { type Entry, loadEntries } from "../entries/record";
import { localeModeOf, type Schema } from "../schema/define";
import { blockHash, blockHashes } from "./links";

type Db = Kysely<Database> | Transaction<Database>;

/** Whether an entry is a translation: written in another language than the site's source language. */
export const isTranslation = (schema: Schema, entry: Pick<Entry, "locale">) => entry.locale !== schema.locales.source;

/** The source-language entry of a group, or `null` when the group has none (a group made before the source language changed is given one). */
export async function sourceEntryOf(db: Db, schema: Schema, group: string): Promise<Entry | null> {
	const row = await db
		.selectFrom("entries")
		.select("id")
		.where("translation_group", "=", group)
		.where("locale", "=", schema.locales.source)
		.where("trashed_at", "is", null)
		.executeTakeFirst();
	return row ? ((await loadEntries(db, [row.id]))[0] ?? null) : null;
}

/** What the site shows of an entry: its body and fields, or `null` when it is not on the site. */
export async function publishedOf(
	db: Db,
	id: string,
): Promise<{ doc: Doc; values: Record<string, unknown>; title: string; slug: string } | null> {
	const row = await db
		.selectFrom("entry_published")
		.select(["doc", "values", "title", "slug"])
		.where("entry_id", "=", id)
		.executeTakeFirst();
	return row ? { doc: asDoc(row.doc), values: row.values, title: row.title, slug: row.slug } : null;
}

/** The source body a translation follows: what the site shows of the source, or its working copy while it is not on the site. */
export async function followedDoc(db: Db, source: Entry): Promise<Doc> {
	return (await publishedOf(db, source.id))?.doc ?? asDoc(source.doc);
}

/** The hashes of the source blocks a translation follows now; none for a source-language entry. */
export async function followedHashes(db: Db, schema: Schema, entry: Entry): Promise<Record<string, string>> {
	if (!isTranslation(schema, entry)) return {};
	const source = await sourceEntryOf(db, schema, entry.translationGroup);
	return source ? blockHashes(await followedDoc(db, source)) : {};
}

/** Keeps source blocks by their hash, so a changed mark can show the block as the translation saw it. */
export async function rememberBlocks(db: Db, blocks: Block[]): Promise<void> {
	if (blocks.length === 0) return;
	await db
		.insertInto("source_blocks")
		.values(blocks.map(({ link: _link, ...block }) => ({ hash: blockHash(block), block: JSON.stringify(block) })))
		.onConflict((conflict) => conflict.column("hash").doNothing())
		.execute();
}

/** Adds source block ids to what a translation left out. */
export async function addSkips(db: Db, entry: Pick<Entry, "id" | "translationSkips">, skipped: string[]) {
	const next = [...new Set([...entry.translationSkips, ...skipped])];
	if (next.length === entry.translationSkips.length) return;
	await db
		.updateTable("entries")
		.set({ translation_skips: JSON.stringify(next) })
		.where("id", "=", entry.id)
		.execute();
}

type Fields = { title: string; slug: string; values: Record<string, unknown> };
const empty = (value: unknown) =>
	value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

/**
 * A translation's fields as the site and the publish check read them (doc 04, field values): `same` is the source's value, `fromSource` its own or
 * the source's while its own is empty, `perLocale` its own. Without a source, its own values.
 */
export function translatedFields(schema: Schema, collection: string, own: Fields, source: Fields | null): Fields {
	if (!source) return own;
	const fields = schema.collections[collection]?.fields ?? {};
	const pick = (name: string, mine: unknown, theirs: unknown) => {
		const definition = fields[name];
		if (!definition) return mine;
		const mode = localeModeOf(name, definition);
		return mode === "same" ? theirs : mode === "fromSource" && empty(mine) ? theirs : mine;
	};
	const values: Record<string, unknown> = {};
	for (const name of Object.keys(fields)) {
		if (name === "title" || name === "slug") continue;
		const value = pick(name, own.values[name], source.values[name]);
		if (value !== undefined) values[name] = value;
	}
	return {
		title: String(pick("title", own.title, source.title) ?? ""),
		slug: String(pick("slug", own.slug, source.slug) ?? ""),
		values,
	};
}

/**
 * A translation's body as the site draws it (doc 04): pending blocks left out, a `followSource` block replaced by its source block as published.
 * Links are the admin's; the site gets none.
 */
export function siteDoc(doc: Doc, source: Doc | null): Doc {
	const sourceBlocks = new Map((source?.blocks ?? []).map((block) => [block.id, block]));
	const blocks = doc.blocks.flatMap(({ link, ...block }): Block[] => {
		if (link?.state === "pending") return [];
		if (link?.state === "followSource") {
			const followed = sourceBlocks.get(link.from);
			if (followed) {
				const { link: _link, ...rest } = followed;
				return [{ ...rest, id: block.id }];
			}
		}
		return [block];
	});
	return { ...doc, blocks };
}
