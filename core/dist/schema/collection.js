export function defineCollection(schema) {
    return normalizeCollection(schema);
}
/**
 * What a collection's kind gives the options its definition leaves out: a document collection has a body and folders, an item collection neither.
 * The one place this default lives; the site, the schema file writer and the admin's schema editor all read it.
 */
export function kindDefaults(kind) {
    const isDocument = kind === "document";
    return { body: isDocument, folders: isDocument };
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
    return { ...rest, kind, body: body ?? kindDefaults(kind).body };
}
