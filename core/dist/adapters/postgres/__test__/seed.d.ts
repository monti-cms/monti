import type { ContentStore, Entry } from "../content-store.js";
/**
 * Test setup helpers. They use the same write paths as production code (`createEntryWithReferences`, `saveWorkingWithReferences`)
 * but can insert raw values that skip snapshot validation (for tests that check only the store contract).
 */
type SeedInput = {
    collection: string;
    slug: string | null;
    metadata: unknown;
    mdx: string;
    schemaVersion?: number;
    contentHash?: string;
    folderId?: string | null;
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
export {};
