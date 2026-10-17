import type { StoredDocument } from "@monti-cms/core/document";
import type { BulkOp, EntryStatus, IncomingReferenceItem, ListEntriesItem, Site } from "@monti-cms/core/site";
import type { EntryData } from "../screens/entries/entry-form.js";
import type { CmsIssue } from "./error-message.js";
/** One page of the list API response. */
export interface EntriesPage {
    items: ListEntriesItem[];
    total: number;
}
/** What `GET /v1/entries/search` answers. */
export type EntrySearchResponse = {
    items: {
        id: string;
        title: string | null;
        slug: string | null;
        status: string;
    }[];
};
/** Query keys. Everything under `all` is refetched after a write; the trash badge count and the other list-wide numbers sit under it too. */
export declare const entriesKeys: {
    all: readonly ["cms", "entries"];
    list: (query: string) => readonly ["cms", "entries", "list", string];
    detail: (id: string) => readonly ["cms", "entries", "detail", string];
    relations: (id: string) => readonly ["cms", "entries", "relations", string];
    search: (query: string) => readonly ["cms", "entries", "search", string];
    taxonomy: (collection?: string) => readonly ["cms", "entries", "taxonomy"] | readonly ["cms", "entries", "taxonomy", string];
    trashCount: () => readonly ["cms", "entries", "trash-count"];
};
/** A status change of an entry. */
export type EntryStatusAction = "archive" | "unarchive" | "trash" | "restore";
/** The body of a save: always the stored document (with block ids). The admin never sends text. */
export type EntryBodyPayload = {
    readonly doc: StoredDocument;
};
/** What a save sends. `translation` is set only when the entry is a translation. */
export type EntrySaveInput = {
    readonly slug: string | null;
    readonly metadata: Record<string, unknown>;
    readonly translation?: unknown;
} & EntryBodyPayload;
/** What a write of the admin API answers: the entry as it is now, and the warnings the write found (never part of the entry). */
export interface EntryWriteResult {
    readonly entry: EntryData;
    readonly warnings: readonly CmsIssue[];
}
export declare const getEntry: <T = EntryData>(site: Site, id: string, signal?: AbortSignal, fallback?: string) => Promise<T>;
/** `GET /v1/entries?<query>` (the list screen, taxonomy options, counts, the editor's internal-link search). */
export declare const listEntries: <T = EntriesPage>(site: Site, query: string | URLSearchParams, signal?: AbortSignal, fallback?: string) => Promise<T>;
/** `GET /v1/entries/search?<query>` (relation pickers: title search, or lookup by `id`). */
export declare const searchEntries: (site: Site, query: string | URLSearchParams, signal?: AbortSignal) => Promise<EntrySearchResponse>;
/** `POST /v1/entries` */
export declare const createEntry: <T = EntryWriteResult>(site: Site, input: {
    collection: string;
    folderId?: string;
    slug: string | null;
    metadata: Record<string, unknown>;
    doc: StoredDocument;
    translation?: unknown;
}, fallback?: string) => Promise<T>;
/** `PATCH /v1/entries/:id` */
export declare const updateEntry: <T = EntryWriteResult>(site: Site, id: string, input: {
    expectedVersion: number;
    slug: string | null;
    metadata: Record<string, unknown>;
    doc?: StoredDocument;
    translation?: unknown;
}, fallback?: string) => Promise<T>;
/** `POST /v1/entries/:id/publish` */
export declare const publishEntry: (site: Site, id: string, input: {
    expectedVersion: number;
    resetPublishedAt?: boolean;
}, fallback?: string) => Promise<EntryWriteResult>;
/** `POST /v1/entries/:id/{archive,unarchive,trash,restore}` */
export declare const changeEntryStatus: (site: Site, id: string, action: EntryStatusAction, input: {
    expectedVersion: number;
}, fallback?: string) => Promise<void>;
/** `POST /v1/entries/:id/duplicate` */
export declare const duplicateEntry: (site: Site, id: string, input: {
    title: string;
}, fallback?: string) => Promise<EntryWriteResult>;
/** `DELETE /v1/entries/:id?expectedVersion=n` (permanent). */
export declare const removeEntry: (site: Site, id: string, input: {
    expectedVersion: number;
}, fallback?: string) => Promise<void>;
/** `GET /v1/entries/:id/relations` (what points at this entry). */
export declare const getEntryRelations: <T = {
    incomingReferences: IncomingReferenceItem[];
}>(site: Site, id: string, signal?: AbortSignal) => Promise<T>;
/** `POST /v1/entries/:id/translations` (a draft translation of the entry in `locale`). */
export declare const createEntryTranslation: (site: Site, id: string, locale: string, fallback?: string) => Promise<{
    entry: {
        id: string;
    };
}>;
export type BulkUsage = {
    entryId: string;
    title: string | null;
    collection: string;
    state: string;
};
export type BulkItemResult = {
    id: string;
    ok: true;
    version: number;
} | {
    id: string;
    ok: false;
    error: string;
    issues?: CmsIssue[];
    usages?: BulkUsage[];
};
/** A row a bulk action targets. `status`, when known, lets a lifecycle action leave out rows it cannot change (`canTransition`). */
export type BulkSelection = {
    id: string;
    expectedVersion: number;
    title?: string | null;
    status?: EntryStatus;
};
export type BulkParams = {
    field?: string;
    ids?: string[];
    id?: string | null;
    folderId?: string | null;
};
/** `POST /v1/bulk`: one answer per item. */
export declare function bulkEntries(site: Site, op: BulkOp, items: BulkSelection[], params?: BulkParams): Promise<BulkItemResult[]>;
/**
 * The server calls the entry editor makes. The default is {@link adminEntryClient} (the admin API). A test or another transport passes its own to
 * `useEntryEditor({ client })`. Methods reject with `CmsApiError` for an error response and with a `TypeError` when the network is down;
 * the editor turns both into an `EditorError`.
 *
 * @experimental
 */
export interface EntryEditorClient {
    get(id: string): Promise<EntryData>;
    /** A write answers the entry and, apart from it, the warnings the server found (a block's syntax check, for one). They never block. */
    create(input: EntrySaveInput & {
        collection: string;
        folderId?: string;
    }): Promise<EntryWriteResult>;
    update(id: string, input: EntrySaveInput & {
        expectedVersion: number;
    }): Promise<EntryWriteResult>;
    publish(id: string, input: {
        expectedVersion: number;
        resetPublishedAt?: boolean;
    }): Promise<EntryWriteResult>;
    changeStatus(id: string, action: EntryStatusAction, input: {
        expectedVersion: number;
    }): Promise<void>;
    duplicate(id: string, input: {
        title: string;
    }): Promise<EntryWriteResult>;
    remove(id: string, input: {
        expectedVersion: number;
    }): Promise<void>;
    relations(id: string): Promise<{
        incomingReferences: IncomingReferenceItem[];
    }>;
}
/**
 * The admin API (`/v1/entries`).
 *
 * @experimental
 */
export declare const adminEntryClient: (site: Site) => EntryEditorClient;
