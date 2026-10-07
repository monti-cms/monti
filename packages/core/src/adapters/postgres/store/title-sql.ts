import { type Expression, type RawBuilder, sql } from "kysely";
import { RECORD_TRANSLATIONS_KEY } from "../../../schema/derive";
import type { Site } from "../../../site";

/**
 * The SQL that reads the title of an entry. The title is the field with the `title` role (see `titleFieldOf`), so no query may write its key by hand:
 * every query that needs a title builds the expression here.
 *
 * It comes in two forms of one rule: `titleExpr` and `translatedTitleExpr` are Kysely expressions for the modules written with Kysely, and `titleSql` and
 * `translatedTitleSql` are the same expressions as SQL text for the modules that are not yet. The text form goes when the last of them moves (`KYSELY.md`).
 *
 * The key is a name from the site config, so it is written as an escaped SQL string literal, never joined in as it is.
 */
const literal = (value: string): string => `'${value.replaceAll("'", "''")}'`;

/** What decides the title field of a row: a collection known by the caller, or the column that holds each row's collection (a query across collections). */
export type TitleOf = { readonly collection: string } | { readonly column: string };

/** The collection of each row of a query across collections (`entries e`). */
export const ROW_COLLECTION: TitleOf = { column: "e.collection" };

/**
 * Which key holds the title, decided once for both forms: one key for every row, or one per collection of the site (a `CASE` over the column).
 * A site whose collections all name the title the same collects it into one plain read.
 */
type TitleKeys =
	| { readonly kind: "key"; readonly key: string }
	| { readonly kind: "by-collection"; readonly column: string; readonly keys: readonly (readonly [string, string])[] };

function titleKeys(site: Site, of: TitleOf): TitleKeys {
	if ("collection" in of) return { kind: "key", key: site.titleField(of.collection).name };
	const keys = site.COLLECTIONS.map((collection) => [collection, site.titleField(collection).name] as const);
	const distinct = new Set(keys.map(([, key]) => key));
	if (distinct.size === 1) return { kind: "key", key: [...distinct][0] as string };
	return { kind: "by-collection", column: of.column, keys };
}

/**
 * `metadata` is a SQL expression for a JSONB metadata column (`w.metadata`). The result is a text expression, `NULL` when the entry has no title.
 * With `{ column }`, a site whose collections all name the title the same collects it into one plain read; otherwise it is a `CASE` over the collections.
 */
export function titleSql(site: Site, metadata: string, of: TitleOf): string {
	const plan = titleKeys(site, of);
	if (plan.kind === "key") return `${metadata}->>${literal(plan.key)}`;
	const branches = plan.keys.map(
		([collection, key]) => `WHEN ${literal(collection)} THEN ${metadata}->>${literal(key)}`,
	);
	return `CASE ${plan.column} ${branches.join(" ")} END`;
}

/**
 * The title of a record collection in one display language: the per-language name (`translations`), falling back to the default-language title.
 * `locale` is a SQL expression for the language (a bind placeholder).
 */
export function translatedTitleSql(site: Site, metadata: string, collection: string, locale: string): string {
	const key = literal(site.titleField(collection).name);
	return `COALESCE(NULLIF(btrim(${metadata}->${literal(RECORD_TRANSLATIONS_KEY)}->${locale}::text->>${key}), ''), ${metadata}->>${key})`;
}

/**
 * `titleSql` as a Kysely expression. `metadata` is a column reference as Kysely writes one (`"w.metadata"`), and so is `of.column`. Use it wherever Kysely
 * expects an expression: `.select(titleExpr(site, "b.metadata", ROW_COLLECTION).as("title"))`, `.where(titleExpr(...), "ilike", pattern)`, `.orderBy(titleExpr(...))`.
 */
export function titleExpr(site: Site, metadata: string, of: TitleOf): RawBuilder<string | null> {
	const plan = titleKeys(site, of);
	const read = (key: string) => sql`${sql.ref(metadata)}->>${sql.lit(key)}`;
	if (plan.kind === "key") return sql<string | null>`${read(plan.key)}`;
	const branches = plan.keys.map(([collection, key]) => sql`when ${sql.lit(collection)} then ${read(key)}`);
	return sql<string | null>`case ${sql.ref(plan.column)} ${sql.join(branches, sql` `)} end`;
}

/** `translatedTitleSql` as a Kysely expression. `locale` is the display language: a value (sent as a bind parameter) or an expression. */
export function translatedTitleExpr(
	site: Site,
	metadata: string,
	collection: string,
	locale: string | Expression<string>,
): RawBuilder<string | null> {
	const key = sql.lit(site.titleField(collection).name);
	const meta = sql.ref(metadata);
	return sql<
		string | null
	>`coalesce(nullif(btrim(${meta}->${sql.lit(RECORD_TRANSLATIONS_KEY)}->${locale}::text->>${key}), ''), ${meta}->>${key})`;
}
