import { sql } from "kysely";
import { RECORD_TRANSLATIONS_KEY } from "../../../schema/derive.js";
/** The collection of each row of a query across collections (`entries e`). */
export const ROW_COLLECTION = { column: "e.collection" };
function titleKeys(site, of) {
    if ("collection" in of)
        return { kind: "key", key: site.titleField(of.collection).name };
    const keys = site.COLLECTIONS.map((collection) => [collection, site.titleField(collection).name]);
    const distinct = new Set(keys.map(([, key]) => key));
    if (distinct.size === 1)
        return { kind: "key", key: [...distinct][0] };
    return { kind: "by-collection", column: of.column, keys };
}
/**
 * The title of a row as a text expression, `NULL` when the entry has no title. With `{ column }`, a site whose collections all name the title the same collects it
 * into one plain read; otherwise it is a `CASE` over the collections. `metadata` is a column reference as Kysely writes one (`"w.metadata"`), and so is `of.column`.
 * Use it wherever Kysely expects an expression: `.select(titleExpr(site, "b.metadata", ROW_COLLECTION).as("title"))`, `.where(titleExpr(...), "ilike", pattern)`, `.orderBy(titleExpr(...))`.
 */
export function titleExpr(site, metadata, of) {
    const plan = titleKeys(site, of);
    const read = (key) => sql `${sql.ref(metadata)}->>${sql.lit(key)}`;
    if (plan.kind === "key")
        return sql `${read(plan.key)}`;
    const branches = plan.keys.map(([collection, key]) => sql `when ${sql.lit(collection)} then ${read(key)}`);
    return sql `case ${sql.ref(plan.column)} ${sql.join(branches, sql ` `)} end`;
}
/**
 * The title of a record collection in one display language: the per-language name (`translations`), falling back to the default-language title.
 * `locale` is the display language: a value (sent as a bind parameter) or an expression. */
export function translatedTitleExpr(site, metadata, collection, locale) {
    const key = sql.lit(site.titleField(collection).name);
    const meta = sql.ref(metadata);
    return sql `coalesce(nullif(btrim(${meta}->${sql.lit(RECORD_TRANSLATIONS_KEY)}->${locale}::text->>${key}), ''), ${meta}->>${key})`;
}
