import { docOfText } from "../../../doc/__test__/doc-text.js";
import { createContentService } from "../../../services/content-service.js";
const rawSnapshot = (input) => ({
    collection: input.collection,
    slug: input.slug,
    metadata: input.metadata,
    doc: input.doc ?? docOfText(input.text ?? ""),
    schemaVersion: input.schemaVersion ?? 1,
    contentHash: input.contentHash ?? `seed-${Math.random().toString(36).slice(2)}`,
    references: [],
    issues: [],
    imageSources: [],
});
/** Creates a draft without references. */
export function seedEntry(store, input) {
    const { folderId, locale, ...rest } = input;
    return store.createEntryWithReferences({ snapshot: rawSnapshot(rest), references: [], folderId, locale });
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
            text: input.text,
            doc: input.doc,
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
            doc: current.working.doc,
            schemaVersion: current.working.schemaVersion,
            contentHash: current.working.contentHash,
        }),
        references,
        folderId: params.folderId,
    });
}
/**
 * Publishes the saved draft the way production does: the draft goes through the write pipeline (no hooks) and the store commits the prepared snapshot.
 * The store does not prepare content, so a store test that publishes goes through here.
 */
export async function publishDraft(site, store, params) {
    return (await createContentService(store, { site }).publish(params)).entry;
}
/** Restores a trashed entry the way production does (a record is prepared by the pipeline first). */
export async function restoreDraft(site, store, params) {
    return (await createContentService(store, { site }).restore(params)).entry;
}
/** Duplicates a draft the way production does (through the write pipeline). */
export async function duplicateDraft(site, store, params) {
    return (await createContentService(store, { site }).duplicate(params)).entry;
}
