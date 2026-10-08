import { valueFieldsOf } from "./walk.js";
/** System columns of the list. They are values of the content itself, not fields. */
export const SYSTEM_LIST_COLUMNS = ["status", "locale", "updatedAt", "createdAt", "publishedAt", "folder"];
/**
 * Checks whether a name can be used by the list columns (`list.columns`). Only system columns, stored field names (including fields dependent on a conditional field),
 * address field names, and `slug` when an address field exists are allowed. It is an error if the name is unknown, the field is not stored (view or reverse relation),
 * or the same name is written twice. Called by `defineSite`.
 */
export function validateListColumns(collection, schema) {
    const columns = schema.list?.columns;
    if (columns === undefined)
        return;
    if (!Array.isArray(columns))
        throw new Error(`cms.config: ${collection}.list.columns must be an array of column names`);
    const stored = new Set(valueFieldsOf(schema).map((field) => field.name));
    const slugFields = Object.entries(schema.fields).filter(([, field]) => field.kind === "slug");
    const system = new Set(SYSTEM_LIST_COLUMNS);
    const seen = new Set();
    for (const column of columns) {
        const at = `cms.config: ${collection}.list.columns`;
        if (typeof column !== "string")
            throw new Error(`${at} must be an array of column names`);
        const field = Object.hasOwn(schema.fields, column) ? schema.fields[column] : undefined;
        const known = system.has(column) ||
            stored.has(column) ||
            slugFields.some(([name]) => name === column) ||
            (column === "slug" && slugFields.length > 0);
        if (!known) {
            if (field)
                throw new Error(`${at} "${column}" is a ${field.kind} field that is not stored, so it cannot be a column`);
            throw new Error(`${at} has unknown column "${column}"; use a field name of ${collection} or one of: ${SYSTEM_LIST_COLUMNS.join(", ")}`);
        }
        if (seen.has(column))
            throw new Error(`${at} lists "${column}" twice`);
        seen.add(column);
    }
}
export function defineCollection(schema) {
    return normalizeCollection(schema);
}
/**
 * Normalizes a collection definition: checks the kind and fills the body default (only `document` has a body).
 * Called by `defineCollection` and `defineSite` (an already normalized definition stays as is).
 * The retired `workflow` option (`"publish"` / `"record"`) is rejected with the `kind` to use instead.
 */
export function normalizeCollection(schema) {
    const { kind } = schema;
    if ("workflow" in schema) {
        const workflow = schema.workflow;
        const replacement = workflow === "record" ? "item" : workflow === "publish" ? "document" : undefined;
        throw new Error(`cms.config: collection "${schema.label}" uses \`workflow\`, which was removed; use \`kind\`${replacement ? ` (kind: "${replacement}" instead of workflow: "${workflow}")` : ' ("document" or "item")'}`);
    }
    if (kind !== "document" && kind !== "item") {
        throw new Error(`cms.config: collection "${schema.label}" needs kind "document" or "item"`);
    }
    const { body, ...rest } = schema;
    if (body !== null && typeof body === "object") {
        if (Array.isArray(body)) {
            throw new Error(`cms.config: collection "${schema.label}" needs \`body\` to be true, false or an object`);
        }
        // The object form means the collection has a body, and limits it.
        return { ...rest, kind, body: true, allowed: body };
    }
    return { ...rest, kind, body: body ?? kind === "document" };
}
