/** Default response shape. No admin-only values (edition, folder, status). */
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
        ...(body ? { body: entry.mdx } : {}),
    };
}
