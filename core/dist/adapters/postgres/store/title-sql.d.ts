import { type Expression, type RawBuilder } from "kysely";
import type { Site } from "../../../site/index.js";
/**
 * The SQL that reads the title of an entry. The title is the field with the `title` role (see `titleFieldOf`), so no query may write its key by hand:
 * every query that needs a title builds the expression here. `titleExpr` and `translatedTitleExpr` are Kysely expressions.
 *
 * The key is a name from the site config, so it is written as an escaped SQL string literal (`sql.lit`), never joined in as it is.
 */
/** What decides the title field of a row: a collection known by the caller, or the column that holds each row's collection (a query across collections). */
export type TitleOf = {
    readonly collection: string;
} | {
    readonly column: string;
};
/** The collection of each row of a query across collections (`entries e`). */
export declare const ROW_COLLECTION: TitleOf;
/**
 * The title of a row as a text expression, `NULL` when the entry has no title. With `{ column }`, a site whose collections all name the title the same collects it
 * into one plain read; otherwise it is a `CASE` over the collections. `metadata` is a column reference as Kysely writes one (`"w.metadata"`), and so is `of.column`.
 * Use it wherever Kysely expects an expression: `.select(titleExpr(site, "b.metadata", ROW_COLLECTION).as("title"))`, `.where(titleExpr(...), "ilike", pattern)`, `.orderBy(titleExpr(...))`.
 */
export declare function titleExpr(site: Site, metadata: string, of: TitleOf): RawBuilder<string | null>;
/**
 * The title of a record collection in one display language: the per-language name (`translations`), falling back to the default-language title.
 * `locale` is the display language: a value (sent as a bind parameter) or an expression. */
export declare function translatedTitleExpr(site: Site, metadata: string, collection: string, locale: string | Expression<string>): RawBuilder<string | null>;
