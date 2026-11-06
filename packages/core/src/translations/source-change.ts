import { type Kysely, sql, type Transaction } from "kysely";
import type { BlockKit } from "../body/blocks";
import { asDoc, type Block, type Doc, newBlockId } from "../body/doc";
import { randomUUID } from "../bytes";
import type { Database } from "../db/schema";
import { type Entry, loadEntries, markChanges } from "../entries/record";
import { localeModeOf, type Schema } from "../schema/define";
import { blockHash, pairedCopy } from "./links";
import { rememberBlocks } from "./source";

type Db = Kysely<Database> | Transaction<Database>;

/**
 * The source language changes from `from` to `to` (doc 04, "원문 언어를 바꾸면"). In every group with an entry in `from`:
 * - the entry in `to` becomes the source; a group without one gets a draft of it, its blocks copied from the old source as pending blocks;
 * - the old source and the other translations are paired again with the new source's blocks;
 * - what the site shows does not change: the same links are written into the published copies, so a published entry stays published.
 */
export async function changeSource(db: Db, from: string, to: string, schema: Schema, kit: BlockKit): Promise<void> {
	const groups = await db
		.selectFrom("entries")
		.select("translation_group")
		.distinct()
		.where("locale", "=", from)
		.where("trashed_at", "is", null)
		.execute();
	for (const { translation_group: group } of groups) {
		const rows = await db
			.selectFrom("entries")
			.select("id")
			.where("translation_group", "=", group)
			.where("trashed_at", "is", null)
			.execute();
		const entries = await loadEntries(
			db,
			rows.map((row) => row.id),
		);
		const old = entries.find((entry) => entry.locale === from);
		if (!old) continue;
		const existing = entries.find((entry) => entry.locale === to);
		const source = existing ? await promote(db, existing, old, schema) : await draftFrom(db, old, to, schema, kit);
		// The old source's block id → the new source's block paired with it.
		const pairedWith = new Map<string, Block>();
		for (const block of source.blocks)
			if (block.link && !pairedWith.has(block.link.from)) pairedWith.set(block.link.from, block);
		const repair = (doc: Doc, isOld: boolean): Doc => ({
			...doc,
			blocks: doc.blocks.map(({ link, ...block }): Block => {
				const key = isOld ? block.id : link?.from;
				const paired = key === undefined ? undefined : pairedWith.get(key);
				if (!paired) return block;
				const state = isOld
					? paired.link?.state === "followSource"
						? "followSource"
						: "translated"
					: (link?.state ?? "translated");
				return { ...block, link: { from: paired.id, seen: blockHash(paired), state } };
			}),
		});
		for (const entry of entries) {
			if (entry.id === existing?.id) continue;
			await rewrite(db, entry, (doc) => repair(doc, entry.id === old.id));
		}
	}
}

/** Writes a new body into an entry's working copy and its published copy alike, and drops what it left out. */
async function rewrite(db: Db, entry: Entry, change: (doc: Doc) => Doc) {
	await db
		.updateTable("entries")
		.set((eb) => ({
			doc: JSON.stringify(change(asDoc(entry.doc))),
			translation_skips: JSON.stringify([]),
			version: eb("version", "+", 1),
		}))
		.where("id", "=", entry.id)
		.execute();
	const published = await db
		.selectFrom("entry_published")
		.select("doc")
		.where("entry_id", "=", entry.id)
		.executeTakeFirst();
	if (published?.doc)
		await sql`update entry_published set doc = ${JSON.stringify(change(asDoc(published.doc)))}::jsonb where entry_id = ${entry.id}`.execute(
			db,
		);
	await markChanges(db, entry.id);
}

/** The `same` fields' values, which live on the source. */
function sameValues(schema: Schema, entry: Entry): Record<string, unknown> {
	const fields = schema.collections[entry.collection]?.fields ?? {};
	return Object.fromEntries(
		Object.entries(entry.values).filter(([name]) => {
			const definition = fields[name];
			return definition !== undefined && localeModeOf(name, definition) === "same";
		}),
	);
}

/** A translation that becomes the source: it takes the `same` values, and keeps only the links of blocks still pending. */
async function promote(db: Db, entry: Entry, old: Entry, schema: Schema): Promise<Doc> {
	const doc = asDoc(entry.doc);
	const values = { ...entry.values, ...sameValues(schema, old) };
	await db
		.updateTable("entries")
		.set((eb) => ({
			values: JSON.stringify(values),
			translation_skips: JSON.stringify([]),
			version: eb("version", "+", 1),
		}))
		.where("id", "=", entry.id)
		.execute();
	const keepPending = (body: Doc): Doc => ({
		...body,
		blocks: body.blocks.map(({ link, ...block }) => (link?.state === "pending" ? { ...block, link } : block)),
	});
	await rewrite(db, { ...entry, translationSkips: [] }, keepPending);
	// The pairing is read before the links go: they say which old block each one came from.
	return doc;
}

/** A group without an entry in the new source language gets a draft of it, made like a new translation of the old source. */
async function draftFrom(db: Db, old: Entry, locale: string, schema: Schema, kit: BlockKit): Promise<Doc> {
	const blocks = asDoc(old.doc).blocks;
	const doc: Doc = { type: "doc", blocks: blocks.map((block) => pairedCopy(block, newBlockId(), kit)) };
	const fields = schema.collections[old.collection]?.fields ?? {};
	const values = Object.fromEntries(
		Object.entries(old.values).filter(([name]) => {
			const definition = fields[name];
			return definition !== undefined && localeModeOf(name, definition) !== "perLocale";
		}),
	);
	await rememberBlocks(db, blocks);
	await db
		.insertInto("entries")
		.values({
			id: randomUUID(),
			collection: old.collection,
			translation_group: old.translationGroup,
			locale,
			// The list shows a group by its source: it keeps the old title until it is translated (doc 04, decisions).
			title: old.title,
			slug: old.slug,
			folder_id: old.folderId,
			values: JSON.stringify(values),
			doc: JSON.stringify(doc),
		})
		.execute();
	return doc;
}
