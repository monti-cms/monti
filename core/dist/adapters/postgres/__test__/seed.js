const rawSnapshot = (input) => ({
    collection: input.collection,
    slug: input.slug,
    metadata: input.metadata,
    mdx: input.mdx,
    schemaVersion: input.schemaVersion ?? 1,
    contentHash: input.contentHash ?? `seed-${Math.random().toString(36).slice(2)}`,
    references: [],
    issues: [],
    imageSources: [],
});
/** Creates a draft without references. */
export function seedEntry(store, input) {
    const { folderId, ...rest } = input;
    return store.createEntryWithReferences({ snapshot: rawSnapshot(rest), references: [], folderId });
}
/** Changes only the draft body and slug, leaving the reference index as is. */
export async function seedSave(store, entryId, input) {
    const current = await store.getEntry(entryId);
    const references = await store.getWorkingReferences({ entryId });
    return store.saveWorkingWithReferences({
        entryId,
        expectedVersion: input.expectedVersion,
        snapshot: rawSnapshot({
            collection: current.collection,
            slug: input.slug !== undefined ? input.slug : current.workingSlug,
            metadata: input.metadata,
            mdx: input.mdx,
            schemaVersion: input.schemaVersion,
            contentHash: input.contentHash,
        }),
        references,
        ...(input.folderId !== undefined ? { folderId: input.folderId } : {}),
    });
}
/** Moves only the folder, leaving the body as is (same path as production's bulk `folder.move`). */
export async function moveToFolder(store, params) {
    const current = await store.getEntry(params.entryId);
    const references = await store.getWorkingReferences({ entryId: params.entryId });
    return store.saveWorkingWithReferences({
        entryId: params.entryId,
        expectedVersion: params.expectedVersion,
        snapshot: rawSnapshot({
            collection: current.collection,
            slug: current.workingSlug,
            metadata: current.working.metadata,
            mdx: current.working.mdx,
            schemaVersion: current.working.schemaVersion,
            contentHash: current.working.contentHash,
        }),
        references,
        folderId: params.folderId,
    });
}
