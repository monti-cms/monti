import { RECORD_TRANSLATIONS_KEY } from "../../../schema/derive";
import type { Site } from "../../../site";

/**
 * The SQL that reads the title of an entry. The title is the field with the `title` role (see `titleFieldOf`), so no query may write its key by hand:
 * every query that needs a title builds the expression here. It is the single place a query builder (Kysely) would replace.
 *
 * The key is a name from the site config, so it is written as an escaped SQL string literal, never joined in as it is.
 */
const literal = (value: string): string => `'${value.replaceAll("'", "''")}'`;

/** What decides the title field of a row: a collection known by the caller, or the column that holds each row's collection (a query across collections). */
export type TitleOf = { readonly collection: string } | { readonly column: string };

/** The collection of each row of a query across collections (`entries e`). */
export const ROW_COLLECTION: TitleOf = { column: "e.collection" };

/**
 * `metadata` is a SQL expression for a JSONB metadata column (`w.metadata`). The result is a text expression, `NULL` when the entry has no title.
 * With `{ column }`, a site whose collections all name the title the same collects it into one plain read; otherwise it is a `CASE` over the collections.
 */
export function titleSql(site: Site, metadata: string, of: TitleOf): string {
	if ("collection" in of) return `${metadata}->>${literal(site.titleField(of.collection).name)}`;
	const keys = new Map(site.COLLECTIONS.map((collection) => [collection, site.titleField(collection).name]));
	const distinct = new Set(keys.values());
	if (distinct.size === 1) return `${metadata}->>${literal([...distinct][0] as string)}`;
	const branches = [...keys].map(
		([collection, key]) => `WHEN ${literal(collection)} THEN ${metadata}->>${literal(key)}`,
	);
	return `CASE ${of.column} ${branches.join(" ")} END`;
}

/**
 * The title of a record collection in one display language: the per-language name (`translations`), falling back to the default-language title.
 * `locale` is a SQL expression for the language (a bind placeholder).
 */
export function translatedTitleSql(site: Site, metadata: string, collection: string, locale: string): string {
	const key = literal(site.titleField(collection).name);
	return `COALESCE(NULLIF(btrim(${metadata}->${literal(RECORD_TRANSLATIONS_KEY)}->${locale}::text->>${key}), ''), ${metadata}->>${key})`;
}
