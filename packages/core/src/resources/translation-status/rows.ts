import { MontiError } from "../../engine/errors";
import type { ReadContext } from "../../engine/types";
import type { Block } from "../../rich-text/types";
import { findEntry } from "../entries/query";
import type { EntryData } from "../media/uses";

/** What a translation locale's `translation_seen` holds: the source values the translator confirmed, as they were then. */
export interface SeenRecord {
	/** The source value of each confirmed field, by key. */
	fields: Record<string, unknown>;
	/** Each confirmed source body block, by its `id`. */
	blocks: Record<string, BlockSeen>;
}

/** A confirmed source body block: linked to a translation block, or excluded from translation. */
export interface BlockSeen {
	link?: string;
	exclude?: true;
	seen_value: Block;
}

/** An active entry's working copy in a translation locale, beside the source working copy's data. */
export interface TranslationRow {
	id: string;
	collection: string;
	locale: string;
	source_locale: string;
	source_data: EntryData;
	data: EntryData;
	/** Empty (`{}`) until something is confirmed. */
	translation_seen: Partial<SeenRecord>;
}

/** The working copies of the active entries in every locale other than their source locale. */
export function translationRows(ctx: ReadContext) {
	return ctx.db
		.selectFrom("entries")
		.innerJoin("entry_locales as source", (join) =>
			join.onRef("source.entry_id", "=", "entries.id").onRef("source.locale", "=", "entries.source_locale"),
		)
		.innerJoin("entry_locales as translation", "translation.entry_id", "entries.id")
		.select([
			"entries.id",
			"entries.collection",
			"translation.locale",
			"entries.source_locale",
			"source.data as source_data",
			"translation.data",
			"translation.translation_seen",
		])
		.where("entries.trashed_at", "is", null)
		.whereRef("translation.locale", "<>", "entries.source_locale")
		.$castTo<TranslationRow>();
}

/** One active entry's working copy in a translation locale; rejects the source locale and a locale the entry lacks. */
export async function findTranslation(ctx: ReadContext, key: { id: string; locale: string }): Promise<TranslationRow> {
	const entry = await findEntry(ctx, { id: key.id }, true);
	if (key.locale === entry.source_locale) {
		throw new MontiError("BAD_REQUEST", "The source locale has no translation status");
	}
	const row = await translationRows(ctx)
		.where("entries.id", "=", key.id)
		.where("translation.locale", "=", key.locale)
		.executeTakeFirst();
	if (row === undefined) throw new MontiError("NOT_FOUND", "The entry does not have this locale");
	return row;
}

/** The record a row holds, with nothing confirmed where it is empty. */
export function seenOf(row: TranslationRow): SeenRecord {
	return { fields: row.translation_seen.fields ?? {}, blocks: row.translation_seen.blocks ?? {} };
}
