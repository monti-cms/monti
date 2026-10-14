export function defineCollection(schema) {
    return normalizeCollection(schema);
}
/**
 * Normalizes a collection definition: fills the body default (only `document` has a body) and turns the object form of `body` into `body: true` and `allowed`.
 * Called by `defineCollection` and `defineSite` (an already normalized definition stays as is). It does not judge the definition: `defineSite` checks the normalized
 * collection, so a missing or unknown `kind`, a retired option and a malformed `body` are reported there, with their paths.
 */
export function normalizeCollection(schema) {
    const { kind, body, ...rest } = schema;
    // The object form means the collection has a body, and limits it.
    if (body !== null && typeof body === "object" && !Array.isArray(body))
        return { ...rest, kind, body: true, allowed: body };
    return { ...rest, kind, body: body ?? kind === "document" };
}
