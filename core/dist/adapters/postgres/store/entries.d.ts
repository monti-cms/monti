import { type PreparedSnapshot, type Reference, type WorkingCopy } from "../../../core/types.js";
import { type StoreContext } from "./context.js";
import type { Publishing } from "./publish.js";
import type { Entry, IncomingReferenceItem, TranslationGroup } from "./types.js";
export declare function createEntryOps(ctx: StoreContext, publishing: Publishing): {
    createEntryWithReferences: (params: {
        snapshot: PreparedSnapshot;
        references: readonly Reference[];
        folderId?: string | null;
        publishImmediately?: boolean;
        /** Content language. Defaults to the default language. */
        locale?: string;
        /** Source ID for a translation (the translation group ID). */
        translationOf?: string;
    }) => Promise<Entry>;
    /**
     * Saves the latest draft. An identical value leaves the version and modified date unchanged.
     * Moving only the folder bumps the version but keeps the content modified date.
     * A scheduled entry may only be moved between folders.
     */
    saveWorkingWithReferences: (params: {
        entryId: string;
        expectedVersion: number;
        snapshot: PreparedSnapshot;
        references: readonly Reference[];
        folderId?: string | null;
        publishImmediately?: boolean;
    }) => Promise<Entry>;
    getWorkingReferences: (params: {
        entryId: string;
    }) => Promise<Reference[]>;
    getWorking: (params: {
        entryId: string;
    }) => Promise<WorkingCopy>;
    /**
     * Translation group. Returns the source and translations in language order. Used by the editor's language switch and `번역본 만들기`.
     */
    getTranslationGroup: (params: {
        entryId: string;
    }) => Promise<TranslationGroup>;
    getEntry: (id: string) => Promise<Entry>;
    /**
     * Admin preview lookup only. Finds an entry and its working body by working slug.
     * Unlike public reads it also finds drafts, archived, and trashed entries, so the caller must pass admin authentication first.
     */
    getWorkingEntryBySlug: (params: {
        collection: string;
        slug: string;
        locale?: string;
    }) => Promise<Entry | null>;
    publishEntry: (params: {
        id: string;
        expectedVersion: number;
        resetPublishedAt?: boolean;
    }) => Promise<Entry>;
    /**
     * Duplicate: copies the latest draft's body, fields, and relations into a new draft with a new ID.
     * Slug, publish status, reservation, published version, publish date, and created/modified times are not copied.
     * If `title` is given, it replaces the copy's title (`title` field). Any suffix (such as "(copy)") is up to the caller.
     * The store saves the given value as is and only checks the title field's rules (length, etc.).
     */
    duplicateEntry: (params: {
        id: string;
        title?: string;
    }) => Promise<Entry>;
    /** The detail screen's `사용처`. Returns field relations and body references split into draft and published. */
    getIncomingReferences: (params: {
        targetId: string;
    }) => Promise<IncomingReferenceItem[]>;
};
