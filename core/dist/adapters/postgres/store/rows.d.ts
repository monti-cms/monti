import { type Selectable } from "kysely";
import type { BodyTemplate, Entry, EntryMetadata, Folder, MediaAssetRecord, PublishedEntryRecord } from "../../../core/store/types.js";
import { type TranslationState } from "../../../core/translation/state.js";
import { type Reference } from "../../../core/types.js";
import { type StoredDocument } from "../../../doc/stored-document.js";
import type { Site } from "../../../site/index.js";
import type { BodyTemplatesTable, ContentAddressesTable, FoldersTable, MediaAssetsTable } from "../db/database.js";
import type { Db } from "../db/kysely.js";
/** Row-to-domain-object conversion and SQL fragments shared by several modules. */
/**
 * Plain text for body search, taken from the stored document: the text of paragraphs, headings, lists, tables and block bodies,
 * the text attributes of blocks (a callout title, an image's alt text and caption), code and math as written, and the text of translation notes. Links keep their label, not their address.
 */
export declare function extractVisibleText(site: Site, doc: StoredDocument): string;
/** A stored document read from a `jsonb` column. A value that is not a stored document of a known version reads as `null`. */
export declare const readDoc: (value: unknown) => StoredDocument | null;
/**
 * The document of a stored body. A body whose `doc` column is empty or unreadable (a row older than stored documents) reads as the document
 * of one `unparsed` node holding its `mdx` column when there is one, so every body a store hands out is a document.
 */
export declare const readBodyDoc: (value: unknown, mdx: string | null) => StoredDocument;
/** A translation state read from a `jsonb` column. A version 2 state (no document) is lifted to version 3. */
export declare const readTranslation: (value: unknown) => TranslationState | null;
export interface BodyRow {
    content_hash: string;
    mdx: string | null;
    doc: StoredDocument;
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
    /** As stored: a body occurrence may still be in the old shape (`{type:"mdx", line, column}`). */
    occurrences: unknown;
}
/** The columns of `content_addresses` the publish check reads. */
export type AddressRow = Pick<Selectable<ContentAddressesTable>, "collection" | "locale" | "slug" | "type" | "entry_id">;
export type FolderRow = Selectable<FoldersTable>;
export declare const mapFolderRow: (row: FolderRow) => Folder;
export declare const mapReferenceRow: (row: ReferenceRow) => Reference;
export declare function mapPublishedEntryRow(row: {
    id: string;
    collection: string;
    locale: string;
    translation_group_id: string;
    slug: string;
    metadata: EntryMetadata;
    doc: unknown;
    published_at: Date | null;
    body_updated_at: Date;
}): PublishedEntryRecord;
/** The columns of `media_assets` that make a `MediaAssetRecord`, in the order the queries select them. */
export declare const MEDIA_COLUMN_NAMES: readonly ["id", "status", "filename", "mime_type", "byte_size", "width", "height", "staging_key", "storage_key", "original_storage_key", "original_staging_key", "original_mime_type", "original_byte_size", "original_width", "original_height", "default_alt", "default_caption", "created_at", "updated_at", "ready_at"];
/** A row of `media_assets` as `MEDIA_COLUMN_NAMES` selects it. */
export type MediaRow = Pick<Selectable<MediaAssetsTable>, (typeof MEDIA_COLUMN_NAMES)[number]>;
export declare const mapMediaRow: (row: MediaRow) => MediaAssetRecord;
/** The columns of `body_templates` that make a `BodyTemplate` (the `mdx` column is no longer read). */
export type TemplateRow = Pick<Selectable<BodyTemplatesTable>, "id" | "name" | "doc" | "version" | "created_at" | "updated_at">;
export declare const mapTemplateRow: (row: TemplateRow) => BodyTemplate;
/** Inserts a reference index row. Picks the FK target column by kind (same rule as the CHECK constraint). */
export declare function insertReferences(db: Db, entryId: string, state: "working" | "published", references: readonly Reference[]): Promise<void>;
export declare function readReferences(db: Db, entryId: string, state: "working" | "published"): Promise<Reference[]>;
export declare function readBody(db: Db, entryId: string, state: "working" | "published"): Promise<BodyRow | undefined>;
/** Writes the working/published body. Also updates the plain text used for search. The `mdx` column is not written: `doc` is the only source of a body. */
export declare function writeBody(site: Site, db: Db, entryId: string, state: "working" | "published", body: {
    metadata: EntryMetadata;
    doc: StoredDocument;
    schemaVersion: number;
    contentHash: string;
    updatedAt: Date;
    /** Translation status of a translation. `null` for the source. */
    translation: TranslationState | null;
}): Promise<void>;
export declare function loadEntry(db: Db, id: string): Promise<Entry>;
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
export declare function lockEntryForUpdate(db: Db, id: string, expectedVersion?: number): Promise<LockedEntryRow>;
