import type { PoolClient } from "pg";
import type { TranslationState } from "../../../core/translation/state.js";
import { type Reference, type ReferenceOccurrence } from "../../../core/types.js";
import type { Queryable } from "./context.js";
import type { BodyTemplate, Entry, EntryMetadata, Folder, MediaAssetRecord, PublishedEntryRecord } from "./types.js";
export declare function normalizeMetadata(input: unknown): EntryMetadata;
/** Plain text for body search. Strips comments, import/export, and tags, and keeps only the label of links. */
export declare function extractVisibleText(mdx: string): string;
export interface BodyRow {
    content_hash: string;
    mdx: string;
    schema_version: number;
    metadata: EntryMetadata;
    updated_at: Date;
    translation: TranslationState | null;
}
export interface ReferenceRow {
    /** Legacy rows may be `category` or `tag`. */
    kind: string;
    target_id: string;
    is_stale: boolean;
    occurrences: readonly ReferenceOccurrence[];
}
export interface AddressRow {
    collection: string;
    slug: string;
    type: "current" | "alias" | "reservation" | "deleted";
    entry_id: string | null;
}
export interface FolderRow {
    id: string;
    collection: string;
    parent_id: string | null;
    name: string;
    position: number;
    version: number;
}
export declare const mapFolderRow: (row: FolderRow) => Folder;
export declare const mapReferenceRow: (row: ReferenceRow) => Reference;
export declare function mapPublishedEntryRow(row: {
    id: string;
    collection: string;
    locale: string;
    translation_group_id: string;
    slug: string;
    metadata: EntryMetadata;
    mdx: string;
    published_at: Date | null;
    body_updated_at: Date;
}): PublishedEntryRecord;
export declare const MEDIA_COLUMNS = "id, status, filename, mime_type, byte_size, width, height, staging_key, storage_key,\n\toriginal_storage_key, original_staging_key, original_mime_type, original_byte_size, original_width, original_height,\n\tdefault_alt, default_caption, created_at, updated_at, ready_at";
export interface MediaRow {
    id: string;
    status: MediaAssetRecord["status"];
    filename: string;
    mime_type: string | null;
    byte_size: string | number | null;
    width: number | null;
    height: number | null;
    staging_key: string | null;
    storage_key: string | null;
    original_storage_key: string | null;
    original_staging_key: string | null;
    original_mime_type: string | null;
    original_byte_size: string | number | null;
    original_width: number | null;
    original_height: number | null;
    default_alt: string | null;
    default_caption: string | null;
    created_at: Date;
    updated_at: Date;
    ready_at: Date | null;
}
export declare const mapMediaRow: (row: MediaRow) => MediaAssetRecord;
export declare const TEMPLATE_COLUMNS = "id, name, mdx, version, created_at, updated_at";
export interface TemplateRow {
    id: string;
    name: string;
    mdx: string;
    version: number;
    created_at: Date;
    updated_at: Date;
}
export declare const mapTemplateRow: (row: TemplateRow) => BodyTemplate;
export declare function isReferencesEqual(a: readonly Reference[], b: readonly Reference[]): boolean;
/** Inserts a reference index row. Picks the FK target column by kind (same rule as the CHECK constraint). */
export declare function insertReferences(client: PoolClient, qSchema: string, entryId: string, state: "working" | "published", references: readonly Reference[]): Promise<void>;
export declare function readReferences(client: Queryable, qSchema: string, entryId: string, state: "working" | "published"): Promise<Reference[]>;
export declare function readBody(client: Queryable, qSchema: string, entryId: string, state: "working" | "published"): Promise<BodyRow | undefined>;
/** Writes the working/published body. Also updates the plain text used for search. */
export declare function writeBody(client: PoolClient, qSchema: string, entryId: string, state: "working" | "published", body: {
    metadata: EntryMetadata;
    mdx: string;
    schemaVersion: number;
    contentHash: string;
    updatedAt: Date;
    /** Translation status of a translation. `null` for the source. */
    translation: TranslationState | null;
}): Promise<void>;
export declare function loadEntry(client: Queryable, id: string, qSchema: string): Promise<Entry>;
export interface LockedEntryRow {
    version: number;
    collection: string;
    locale: string;
    /** Translation group ID. For the source, its own ID. */
    translation_group_id: string;
    status: Entry["status"];
    updated_at: Date;
    working_slug: string | null;
}
/** Locks the entry row with a version check. 404 if missing, 409 if the version differs. */
export declare function lockEntryForUpdate(client: PoolClient, qSchema: string, id: string, expectedVersion?: number): Promise<LockedEntryRow>;
