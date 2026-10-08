import type { StoredDocument } from "../../../doc/stored-document.js";
import type { Site } from "../../../site/index.js";
import type { ContentStore, Entry } from "..";
/**
 * Test setup helpers. They use the same write paths as production code (`createEntryWithReferences`, `saveWorkingWithReferences`)
 * but can insert raw values that skip snapshot validation (for tests that check only the store contract).
 */
type SeedInput = {
    collection: string;
    slug: string | null;
    metadata: unknown;
    /** The body as plain text (read by `docOfText`) unless `doc` is given. */
    text?: string;
    doc?: StoredDocument;
    schemaVersion?: number;
    contentHash?: string;
    folderId?: string | null;
    locale?: string;
};
/** Creates a draft without references. */
export declare function seedEntry(store: ContentStore, input: SeedInput): Promise<Entry>;
/** Changes only the draft body and slug, leaving the reference index as is. */
export declare function seedSave(store: ContentStore, entryId: string, input: Omit<SeedInput, "collection" | "slug"> & {
    expectedVersion: number;
    slug?: string | null;
}): Promise<Entry>;
/** Moves only the folder, leaving the body as is (same path as production's bulk `folder.move`). */
export declare function moveToFolder(store: ContentStore, params: {
    entryId: string;
    folderId: string | null;
    expectedVersion: number;
}): Promise<Entry>;
/**
 * Publishes the saved draft the way production does: the draft goes through the write pipeline (no hooks) and the store commits the prepared snapshot.
 * The store does not prepare content, so a store test that publishes goes through here.
 */
export declare function publishDraft(site: Site, store: ContentStore, params: {
    id: string;
    expectedVersion: number;
    resetPublishedAt?: boolean;
}): Promise<Entry>;
/** Restores a trashed entry the way production does (a record is prepared by the pipeline first). */
export declare function restoreDraft(site: Site, store: ContentStore, params: {
    id: string;
    expectedVersion: number;
}): Promise<Entry>;
/** Duplicates a draft the way production does (through the write pipeline). */
export declare function duplicateDraft(site: Site, store: ContentStore, params: {
    id: string;
    title?: string;
}): Promise<Entry>;
export {};
