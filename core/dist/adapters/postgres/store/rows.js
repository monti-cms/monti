import { sql } from "kysely";
import { documentText, SEARCH_TEXT } from "../../../core/body-text.js";
import { CmsError } from "../../../core/store/errors.js";
import { parseTranslationState } from "../../../core/translation/state.js";
import { normalizeReferenceKind, readReferenceOccurrences } from "../../../core/types.js";
import { emptyStoredDocument, readStoredDocument, unparsedDocument, } from "../../../doc/stored-document.js";
/** Row-to-domain-object conversion and SQL fragments shared by several modules. */
/**
 * Plain text for body search, taken from the stored document: the text of paragraphs, headings, lists, tables and block bodies,
 * the text attributes of blocks (a callout title, an image's alt text and caption), code and math as written, and the text of translation notes. Links keep their label, not their address.
 */
export function extractVisibleText(site, doc) {
    return documentText(site, doc, SEARCH_TEXT);
}
/** A stored document read from a `jsonb` column. A value that is not a stored document of a known version reads as `null`. */
export const readDoc = (value) => readStoredDocument(value) ?? null;
/**
 * The document of a stored body. A body whose `doc` column is empty or unreadable (a row older than stored documents) reads as the document
 * of one `unparsed` node holding its `mdx` column when there is one, so every body a store hands out is a document.
 */
export const readBodyDoc = (value, mdx) => readDoc(value) ?? unparsedDocument(mdx ?? "");
/** A translation state read from a `jsonb` column. A version 2 state (no document) is lifted to version 3. */
export const readTranslation = (value) => value === null || value === undefined ? null : (parseTranslationState(value) ?? value);
export const mapFolderRow = (row) => ({
    id: row.id,
    collection: row.collection,
    parentId: row.parent_id,
    name: row.name,
    position: row.position,
    version: row.version ?? 1,
});
export const mapReferenceRow = (row) => ({
    kind: normalizeReferenceKind(row.kind),
    targetId: row.target_id,
    isStale: row.is_stale,
    occurrences: readReferenceOccurrences(row.occurrences),
});
export function mapPublishedEntryRow(row) {
    return {
        id: row.id,
        collection: row.collection,
        locale: row.locale,
        translationGroupId: row.translation_group_id,
        slug: row.slug,
        metadata: row.metadata,
        doc: row.doc === null || row.doc === undefined ? null : readBodyDoc(row.doc, null),
        publishedAt: row.published_at,
        updatedAt: row.body_updated_at,
    };
}
/** The columns of `media_assets` that make a `MediaAssetRecord`, in the order the queries select them. */
export const MEDIA_COLUMN_NAMES = [
    "id",
    "status",
    "filename",
    "mime_type",
    "byte_size",
    "width",
    "height",
    "staging_key",
    "storage_key",
    "original_storage_key",
    "original_staging_key",
    "original_mime_type",
    "original_byte_size",
    "original_width",
    "original_height",
    "default_alt",
    "default_caption",
    "created_at",
    "updated_at",
    "ready_at",
];
const toNumberOrNull = (value) => (value === null ? null : Number(value));
export const mapMediaRow = (row) => ({
    id: row.id,
    status: row.status,
    filename: row.filename,
    mimeType: row.mime_type,
    byteSize: toNumberOrNull(row.byte_size),
    width: row.width,
    height: row.height,
    stagingKey: row.staging_key,
    storageKey: row.storage_key,
    original: row.original_staging_key || row.original_storage_key
        ? {
            storageKey: row.original_storage_key,
            stagingKey: row.original_staging_key,
            mimeType: row.original_mime_type,
            byteSize: toNumberOrNull(row.original_byte_size),
            width: row.original_width,
            height: row.original_height,
        }
        : null,
    defaultAlt: row.default_alt ?? "",
    defaultCaption: row.default_caption ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    readyAt: row.ready_at,
});
export const mapTemplateRow = (row) => ({
    id: row.id,
    name: row.name,
    // Migration 0019 gave every template a document; one that still has none (a row written by hand) reads as empty.
    doc: readDoc(row.doc) ?? emptyStoredDocument(),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});
/** Inserts a reference index row. Picks the FK target column by kind (same rule as the CHECK constraint). */
export async function insertReferences(db, entryId, state, references) {
    for (const ref of references) {
        await db
            .insertInto("entry_references")
            .values({
            entry_id: entryId,
            state,
            kind: ref.kind,
            target_id: ref.targetId,
            target_entry_id: ref.kind === "media" ? null : ref.targetId,
            target_media_id: ref.kind === "media" ? ref.targetId : null,
            is_stale: ref.isStale,
            occurrences: JSON.stringify(ref.occurrences),
        })
            .execute();
    }
}
export async function readReferences(db, entryId, state) {
    const rows = await db
        .selectFrom("entry_references")
        .select(["kind", "target_id", "is_stale", "occurrences"])
        .where("entry_id", "=", entryId)
        .where("state", "=", state)
        .orderBy("kind", "asc")
        .orderBy("target_id", "asc")
        .execute();
    return rows.map(mapReferenceRow);
}
export async function readBody(db, entryId, state) {
    const row = await db
        .selectFrom("entry_bodies")
        .select(["metadata", "mdx", "doc", "schema_version", "content_hash", "updated_at", "translation"])
        .where("entry_id", "=", entryId)
        .where("state", "=", state)
        .executeTakeFirst();
    return row && { ...row, doc: readBodyDoc(row.doc, row.mdx), translation: readTranslation(row.translation) };
}
/** The value a conflicting insert of `entry_bodies` proposed (`EXCLUDED.<column>`), for the `DO UPDATE` of `writeBody`. */
const proposed = (column) => sql.ref(`excluded.${column}`);
/** Writes the working/published body. Also updates the plain text used for search. The `mdx` column is not written: `doc` is the only source of a body. */
export async function writeBody(site, db, entryId, state, body) {
    await db
        .insertInto("entry_bodies")
        .values({
        entry_id: entryId,
        state,
        metadata: JSON.stringify(body.metadata),
        doc: JSON.stringify(body.doc),
        schema_version: body.schemaVersion,
        content_hash: body.contentHash,
        updated_at: body.updatedAt,
        search_text: extractVisibleText(site, body.doc),
        translation: body.translation === null ? null : JSON.stringify(body.translation),
    })
        .onConflict((conflict) => conflict.columns(["entry_id", "state"]).doUpdateSet({
        metadata: proposed("metadata"),
        doc: proposed("doc"),
        schema_version: proposed("schema_version"),
        content_hash: proposed("content_hash"),
        updated_at: proposed("updated_at"),
        search_text: proposed("search_text"),
        translation: proposed("translation"),
    }))
        .execute();
}
export async function loadEntry(db, id) {
    const rows = await db
        .selectFrom("entries as e")
        .leftJoin("entry_bodies as b", "e.id", "b.entry_id")
        .select((eb) => [
        "e.id",
        "e.collection",
        "e.locale",
        sql `coalesce(e.translation_group_id, e.id)`.as("translation_group_id"),
        "e.status",
        "e.version",
        "e.folder_id",
        "e.created_at",
        "e.updated_at as entry_updated_at",
        "e.changed_by",
        "e.changed_at",
        "e.published_at",
        "e.trashed_at",
        "e.working_slug",
        eb
            .selectFrom("content_addresses")
            .select("slug")
            .whereRef("entry_id", "=", "e.id")
            .where("type", "=", "current")
            .as("current_slug"),
        "b.state",
        "b.metadata",
        "b.mdx",
        "b.doc",
        "b.schema_version",
        "b.content_hash",
        "b.updated_at as body_updated_at",
        "b.translation",
    ])
        .where("e.id", "=", id)
        .execute();
    const first = rows[0];
    if (!first)
        throw new CmsError("Entry not found", "not_found");
    let working;
    let published;
    for (const row of rows) {
        if (row.state === null || row.metadata === null)
            continue;
        if (row.schema_version === null || row.content_hash === null || row.body_updated_at === null)
            continue;
        const body = {
            metadata: row.metadata,
            doc: readBodyDoc(row.doc, row.mdx),
            schemaVersion: row.schema_version,
            contentHash: row.content_hash,
            updatedAt: row.body_updated_at,
            translation: readTranslation(row.translation),
        };
        if (row.state === "working")
            working = body;
        else
            published = body;
    }
    if (!working)
        throw new CmsError("Entry missing working state", "invalid_state");
    return {
        id: first.id,
        collection: first.collection,
        locale: first.locale,
        translationGroupId: first.translation_group_id,
        status: first.status || "draft",
        version: first.version,
        folderId: first.folder_id,
        createdAt: first.created_at,
        updatedAt: first.entry_updated_at,
        changedAt: first.changed_at ?? first.entry_updated_at,
        ...(first.changed_by ? { changedBy: first.changed_by } : {}),
        publishedAt: first.published_at ?? undefined,
        trashedAt: first.trashed_at ?? undefined,
        workingSlug: first.working_slug,
        publishedSlug: first.current_slug ?? null,
        working,
        published,
    };
}
/** Locks the entry row with a version check. 404 if missing, 409 if the version differs. */
export async function lockEntryForUpdate(db, id, expectedVersion) {
    const row = await db
        .selectFrom("entries")
        .select([
        "version",
        "collection",
        "locale",
        sql `coalesce(translation_group_id, id)`.as("translation_group_id"),
        "status",
        "updated_at",
        "working_slug",
    ])
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirst();
    if (!row)
        throw new CmsError("Entry not found", "not_found");
    if (expectedVersion !== undefined && row.version !== expectedVersion) {
        throw new CmsError("Conflict", "conflict", row.version);
    }
    return row;
}
