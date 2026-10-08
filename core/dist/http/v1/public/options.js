/**
 * Default response shape. No admin-only values (edition, folder, status).
 * A single read adds the body: `doc` (the stored document), `refs` (the public URLs of its media keyed by media id, and the address and title of its internal links keyed by entry id; only what the document uses)
 * With `?format=<name>` it also carries `body`: the document as text in that format, as `{ format, text }`.
 */
export function defaultPublicJson(entry, { body }) {
    return {
        id: entry.translationGroupId,
        collection: entry.collection,
        locale: entry.locale,
        slug: entry.slug,
        path: entry.path,
        title: entry.title,
        publishedAt: entry.publishedAt?.toISOString() ?? null,
        updatedAt: entry.updatedAt.toISOString(),
        metadata: entry.metadata,
        relations: entry.relations,
        ...(body ? { doc: entry.doc, refs: entry.refs, ...(entry.body ? { body: entry.body } : {}) } : {}),
    };
}
