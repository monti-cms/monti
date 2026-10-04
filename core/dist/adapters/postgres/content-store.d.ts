import type { Pool } from "pg";
import { type AfterCommit } from "./store/after-commit.js";
import { type ContentStoreHooks } from "./store/context.js";
/**
 * PostgreSQL `ContentStore`. Reads and atomic changes for content, folders, relations, media metadata, and settings.
 * The driver and SQL live only in the modules under `store/`. Business rules (snapshots, publish validation) come from `core/`.
 */
export type { AfterCommit, ContentChange, ContentChangeKind } from "./store/after-commit.js";
export { PUBLIC_COLLECTIONS } from "./store/constants.js";
export type { ContentStoreHooks } from "./store/context.js";
export { CmsError } from "./store/errors.js";
export type { FolderRow } from "./store/rows.js";
export { extractVisibleText, normalizeMetadata } from "./store/rows.js";
export { migrateContentStore } from "./store/schema.js";
export * from "./store/types.js";
export declare function createContentStore(pool: Pool, options?: {
    schema?: string;
    afterCommit?: AfterCommit;
} & ContentStoreHooks): {
    createEntryWithReferences: (params: {
        snapshot: import("../../client.js").PreparedSnapshot;
        references: readonly import("../../client.js").Reference[];
        folderId?: string | null;
        publishImmediately?: boolean;
        locale?: string;
        translationOf?: string;
    }) => Promise<import("./content-store.js").Entry>;
    saveWorkingWithReferences: (params: {
        entryId: string;
        expectedVersion: number;
        snapshot: import("../../client.js").PreparedSnapshot;
        references: readonly import("../../client.js").Reference[];
        folderId?: string | null;
        publishImmediately?: boolean;
    }) => Promise<import("./content-store.js").Entry>;
    getWorkingReferences: (params: {
        entryId: string;
    }) => Promise<import("../../client.js").Reference[]>;
    getWorking: (params: {
        entryId: string;
    }) => Promise<import("../../client.js").WorkingCopy>;
    getTranslationGroup: (params: {
        entryId: string;
    }) => Promise<import("./content-store.js").TranslationGroup>;
    getEntry: (id: string) => Promise<import("./content-store.js").Entry>;
    getWorkingEntryBySlug: (params: {
        collection: string;
        slug: string;
        locale?: string;
    }) => Promise<import("./content-store.js").Entry | null>;
    publishEntry: (params: {
        id: string;
        expectedVersion: number;
        resetPublishedAt?: boolean;
    }) => Promise<import("./content-store.js").Entry>;
    duplicateEntry: (params: {
        id: string;
        title?: string;
    }) => Promise<import("./content-store.js").Entry>;
    getIncomingReferences: (params: {
        targetId: string;
    }) => Promise<import("./content-store.js").IncomingReferenceItem[]>;
    createFolder: (params: {
        collection: string;
        parentId: string | null;
        name: string;
        position?: number;
    }) => Promise<import("./content-store.js").Folder>;
    updateFolder: (params: {
        id: string;
        expectedVersion?: number;
        name?: string;
        parentId?: string | null;
        position?: number;
    }) => Promise<import("./content-store.js").Folder>;
    deleteFolder: (params: {
        id: string;
        expectedVersion?: number;
    }) => Promise<void>;
    getFolderContents: (params: {
        id: string;
    }) => Promise<{
        entryCount: number;
        childFolders: import("./content-store.js").Folder[];
    }>;
    listFolders: (params: {
        collection: string;
    }) => Promise<import("./content-store.js").Folder[]>;
    archiveEntry: (params: {
        id: string;
        expectedVersion: number;
    }) => Promise<import("./content-store.js").Entry>;
    unarchiveEntry: (params: {
        id: string;
        expectedVersion: number;
    }) => Promise<import("./content-store.js").Entry>;
    trashEntry: (params: {
        id: string;
        expectedVersion: number;
    }) => Promise<import("./content-store.js").Entry>;
    restoreEntry: (params: {
        id: string;
        expectedVersion: number;
    }) => Promise<import("./content-store.js").Entry>;
    permanentDeleteEntry: (params: {
        id: string;
        expectedVersion: number;
    }) => Promise<void>;
    listEntries: (params: import("./content-store.js").ListEntriesParams) => Promise<import("./content-store.js").ListEntriesResult>;
    createMediaAsset: (input: import("./content-store.js").CreateMediaAssetInput) => Promise<import("./content-store.js").MediaAssetRecord>;
    getMediaAsset: (id: string) => Promise<import("./content-store.js").MediaAssetRecord | null>;
    completeMediaAsset: (input: import("./content-store.js").CompleteMediaAssetInput) => Promise<import("./content-store.js").MediaAssetRecord>;
    failMediaAsset: (id: string) => Promise<void>;
    updateMediaMetadata: (params: {
        id: string;
        filename?: string;
        defaultAlt?: string;
        defaultCaption?: string;
    }) => Promise<import("./content-store.js").MediaAssetRecord>;
    listMediaAssets: (params?: import("./content-store.js").ListMediaParams) => Promise<import("./content-store.js").ListMediaResult>;
    beginMediaDelete: (id: string) => Promise<import("./content-store.js").MediaAssetRecord>;
    finalizeMediaDelete: (id: string) => Promise<void>;
    listStaleUploads: (params: {
        before: Date;
    }) => Promise<import("./content-store.js").MediaAssetRecord[]>;
    getPreferences: (params: {
        userId: string;
    }) => Promise<import("./content-store.js").JsonObject | null>;
    savePreferences: (params: {
        userId: string;
        preferences: import("./content-store.js").JsonObject;
    }) => Promise<void>;
    listPublishedEntries: (params: {
        collections: readonly string[];
        includeBody?: boolean;
        locale?: string;
    }) => Promise<import("./content-store.js").PublishedEntryRecord[]>;
    getPublishedEntryBySlug: (params: {
        collection: string;
        slug: string;
        includeBody?: boolean;
        locale?: string;
    }) => Promise<import("./content-store.js").PublishedEntryLookup>;
    listPublishedPage: (params: import("./store/public-read.js").PublishedPageParams) => Promise<{
        items: import("./content-store.js").PublishedEntryRecord[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    listPublishedTranslations: (params: {
        translationGroupId: string;
    }) => Promise<{
        id: string;
        collection: string;
        locale: string;
        slug: string;
    }[]>;
    listPublishedByGroups: (params: {
        translationGroupIds: readonly string[];
    }) => Promise<import("./content-store.js").PublishedEntryRecord[]>;
    listTemplates: () => Promise<import("./content-store.js").BodyTemplate[]>;
    getTemplate: (id: string) => Promise<import("./content-store.js").BodyTemplate>;
    createTemplate: (data: {
        name: string;
        mdx: string;
    }) => Promise<import("./content-store.js").BodyTemplate>;
    updateTemplate: (params: {
        id: string;
        expectedVersion: number;
        name?: string;
        mdx?: string;
    }) => Promise<import("./content-store.js").BodyTemplate>;
    deleteTemplate: (params: {
        id: string;
        expectedVersion: number;
    }) => Promise<void>;
    readExportSnapshot: () => Promise<import("./content-store.js").ExportSnapshot>;
};
export type ContentStore = ReturnType<typeof createContentStore>;
