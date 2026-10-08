import type { Entry, IncomingReferenceItem, TranslationGroup } from "../../../core/store/types.js";
import type { Issue } from "../../../core/types.js";
import { type PreparedSnapshot, type Reference, type WorkingCopy } from "../../../core/types.js";
import { type StoreContext } from "./context.js";
import type { Publishing } from "./publish.js";
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
        /** With `publishImmediately`: reset the publish date to now. */
        resetPublishedAt?: boolean;
        /** Sets the publish date (instead of now or the kept first-publish time), for content that was published before it came here. */
        publishedAt?: Date;
        /** With `publishImmediately`: receives the notices of the publish checks. */
        onWarnings?: (warnings: readonly Issue[]) => void;
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
    /** Publishes the saved draft. `snapshot` is the prepared draft (see `PublishOptions.snapshot`). */
    publishEntry: (params: {
        id: string;
        expectedVersion: number;
        snapshot: PreparedSnapshot;
        resetPublishedAt?: boolean;
        /** Sets the publish date (instead of now or the kept first-publish time), for content that was published before it came here. */
        publishedAt?: Date;
        onWarnings?: (warnings: readonly Issue[]) => void;
    }) => Promise<Entry>;
    slugsInUse: (params: {
        collection: string;
        locale: string;
        slugs: readonly string[];
        excludeEntryId?: string;
    }) => Promise<Set<string>>;
    resolveLinkTargets: (params: {
        addresses: readonly {
            collection: string;
            slug: string;
            locale?: string;
        }[];
    }) => Promise<{
        collection: string;
        slug: string;
        locale: string;
        entryId: string;
    }[]>;
    /** The detail screen's `사용처`. Returns field relations and body references split into draft and published. */
    getIncomingReferences: (params: {
        targetId: string;
    }) => Promise<IncomingReferenceItem[]>;
};
