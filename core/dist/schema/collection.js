/** Said when a collection still has the retired `list` option. */
export const LIST_REMOVED = "List columns are no longer part of the schema: each admin chooses them on the list screen (Column settings). Delete the `list` key.";
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
    if ("list" in schema) {
        throw new Error(`cms.config: collection "${schema.label}" uses \`list\`. ${LIST_REMOVED}`);
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
