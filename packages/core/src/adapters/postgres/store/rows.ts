import type { PoolClient } from "pg";
import { documentText, SEARCH_TEXT } from "../../../core/body-text";
import { CmsError } from "../../../core/store/errors";
import type {
	BodyTemplate,
	Entry,
	EntryBody,
	EntryMetadata,
	Folder,
	MediaAssetRecord,
	PublishedEntryRecord,
} from "../../../core/store/types";
import { parseTranslationState, type TranslationState } from "../../../core/translation/state";
import { normalizeReferenceKind, type Reference, readReferenceOccurrences } from "../../../core/types";
import {
	emptyStoredDocument,
	readStoredDocument,
	type StoredDocument,
	unparsedDocument,
} from "../../../doc/stored-document";
import type { Site } from "../../../site";
import type { Queryable } from "./context";

/** Row-to-domain-object conversion and SQL fragments shared by several modules. */

/**
 * Plain text for body search, taken from the stored document: the text of paragraphs, headings, lists, tables and block bodies,
 * the text attributes of blocks (a callout title, an image's alt text and caption), code and math as written, and the text of translation notes. Links keep their label, not their address.
 */
export function extractVisibleText(site: Site, doc: StoredDocument): string {
	return documentText(site, doc, SEARCH_TEXT);
}

/** A stored document read from a `jsonb` column. A value that is not a stored document of a known version reads as `null`. */
export const readDoc = (value: unknown): StoredDocument | null => readStoredDocument(value) ?? null;

/**
 * The document of a stored body. A body whose `doc` column is empty or unreadable (a row older than stored documents) reads as the document
 * of one `unparsed` node holding its `mdx` column when there is one, so every body a store hands out is a document.
 */
export const readBodyDoc = (value: unknown, mdx: string | null): StoredDocument =>
	readDoc(value) ?? unparsedDocument(mdx ?? "");

/** A translation state read from a `jsonb` column. A version 2 state (no document) is lifted to version 3. */
export const readTranslation = (value: unknown): TranslationState | null =>
	value === null || value === undefined ? null : (parseTranslationState(value) ?? (value as TranslationState));

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

export interface AddressRow {
	collection: string;
	locale: string;
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

export const mapFolderRow = (row: FolderRow): Folder => ({
	id: row.id,
	collection: row.collection,
	parentId: row.parent_id,
	name: row.name,
	position: row.position,
	version: row.version ?? 1,
});

export const mapReferenceRow = (row: ReferenceRow): Reference => ({
	kind: normalizeReferenceKind(row.kind),
	targetId: row.target_id,
	isStale: row.is_stale,
	occurrences: readReferenceOccurrences(row.occurrences),
});

export function mapPublishedEntryRow(row: {
	id: string;
	collection: string;
	locale: string;
	translation_group_id: string;
	slug: string;
	metadata: EntryMetadata;
	doc: unknown;
	published_at: Date | null;
	body_updated_at: Date;
}): PublishedEntryRecord {
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
] as const;

export const MEDIA_COLUMNS = MEDIA_COLUMN_NAMES.join(", ");

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

const toNumberOrNull = (value: string | number | null) => (value === null ? null : Number(value));

export const mapMediaRow = (row: MediaRow): MediaAssetRecord => ({
	id: row.id,
	status: row.status,
	filename: row.filename,
	mimeType: row.mime_type,
	byteSize: toNumberOrNull(row.byte_size),
	width: row.width,
	height: row.height,
	stagingKey: row.staging_key,
	storageKey: row.storage_key,
	original:
		row.original_staging_key || row.original_storage_key
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

export const TEMPLATE_COLUMNS = "id, name, doc, version, created_at, updated_at";

export interface TemplateRow {
	id: string;
	name: string;
	doc: unknown;
	version: number;
	created_at: Date;
	updated_at: Date;
}

export const mapTemplateRow = (row: TemplateRow): BodyTemplate => ({
	id: row.id,
	name: row.name,
	// Migration 0019 gave every template a document; one that still has none (a row written by hand) reads as empty.
	doc: readDoc(row.doc) ?? emptyStoredDocument(),
	version: row.version,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
});

/** Inserts a reference index row. Picks the FK target column by kind (same rule as the CHECK constraint). */
export async function insertReferences(
	client: PoolClient,
	qSchema: string,
	entryId: string,
	state: "working" | "published",
	references: readonly Reference[],
): Promise<void> {
	for (const ref of references) {
		const targetEntryId = ref.kind === "media" ? null : ref.targetId;
		const targetMediaId = ref.kind === "media" ? ref.targetId : null;
		await client.query(
			`INSERT INTO "${qSchema}".entry_references
			 (entry_id, state, kind, target_id, target_entry_id, target_media_id, is_stale, occurrences)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			[
				entryId,
				state,
				ref.kind,
				ref.targetId,
				targetEntryId,
				targetMediaId,
				ref.isStale,
				JSON.stringify(ref.occurrences),
			],
		);
	}
}

export async function readReferences(
	client: Queryable,
	qSchema: string,
	entryId: string,
	state: "working" | "published",
): Promise<Reference[]> {
	const res = await client.query<ReferenceRow>(
		`SELECT kind, target_id, is_stale, occurrences FROM "${qSchema}".entry_references
		 WHERE entry_id = $1 AND state = $2 ORDER BY kind ASC, target_id ASC`,
		[entryId, state],
	);
	return res.rows.map(mapReferenceRow);
}

export async function readBody(
	client: Queryable,
	qSchema: string,
	entryId: string,
	state: "working" | "published",
): Promise<BodyRow | undefined> {
	const res = await client.query<Omit<BodyRow, "doc"> & { doc: unknown }>(
		`SELECT metadata, mdx, doc, schema_version, content_hash, updated_at, translation FROM "${qSchema}".entry_bodies
		 WHERE entry_id = $1 AND state = $2`,
		[entryId, state],
	);
	const row = res.rows[0];
	return row && { ...row, doc: readBodyDoc(row.doc, row.mdx), translation: readTranslation(row.translation) };
}

/** Writes the working/published body. Also updates the plain text used for search. The `mdx` column is not written: `doc` is the only source of a body. */
export async function writeBody(
	site: Site,
	client: PoolClient,
	qSchema: string,
	entryId: string,
	state: "working" | "published",
	body: {
		metadata: EntryMetadata;
		doc: StoredDocument;
		schemaVersion: number;
		contentHash: string;
		updatedAt: Date;
		/** Translation status of a translation. `null` for the source. */
		translation: TranslationState | null;
	},
): Promise<void> {
	await client.query(
		`INSERT INTO "${qSchema}".entry_bodies (entry_id, state, metadata, doc, schema_version, content_hash, updated_at, search_text, translation)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 ON CONFLICT (entry_id, state) DO UPDATE SET
		   metadata = EXCLUDED.metadata, doc = EXCLUDED.doc, schema_version = EXCLUDED.schema_version,
		   content_hash = EXCLUDED.content_hash, updated_at = EXCLUDED.updated_at, search_text = EXCLUDED.search_text,
		   translation = EXCLUDED.translation`,
		[
			entryId,
			state,
			JSON.stringify(body.metadata),
			JSON.stringify(body.doc),
			body.schemaVersion,
			body.contentHash,
			body.updatedAt,
			extractVisibleText(site, body.doc),
			body.translation === null ? null : JSON.stringify(body.translation),
		],
	);
}

interface EntryRow {
	id: string;
	collection: string;
	locale: string;
	translation_group_id: string;
	status: Entry["status"];
	version: number;
	folder_id: string | null;
	created_at: Date;
	entry_updated_at: Date;
	changed_by: string | null;
	changed_at: Date | null;
	published_at: Date | null;
	trashed_at: Date | null;
	working_slug: string | null;
	current_slug: string | null;
	state: "working" | "published" | null;
	metadata: EntryMetadata | null;
	mdx: string | null;
	doc: unknown;
	schema_version: number | null;
	content_hash: string | null;
	body_updated_at: Date | null;
	translation: TranslationState | null;
}

export async function loadEntry(client: Queryable, id: string, qSchema: string): Promise<Entry> {
	const res = await client.query<EntryRow>(
		`SELECT
			e.id, e.collection, e.locale, COALESCE(e.translation_group_id, e.id) AS translation_group_id,
			e.status, e.version, e.folder_id, e.created_at, e.updated_at as entry_updated_at,
			e.changed_by, e.changed_at, e.published_at, e.trashed_at, e.working_slug,
			(SELECT slug FROM "${qSchema}".content_addresses WHERE entry_id = e.id AND type = 'current') as current_slug,
			b.state, b.metadata, b.mdx, b.doc, b.schema_version, b.content_hash, b.updated_at as body_updated_at, b.translation
		 FROM "${qSchema}".entries e
		 LEFT JOIN "${qSchema}".entry_bodies b ON e.id = b.entry_id
		 WHERE e.id = $1`,
		[id],
	);
	const first = res.rows[0];
	if (!first) throw new CmsError("Entry not found", "not_found");

	let working: EntryBody | undefined;
	let published: EntryBody | undefined;
	for (const row of res.rows) {
		if (row.state === null || row.metadata === null) continue;
		if (row.schema_version === null || row.content_hash === null || row.body_updated_at === null) continue;
		const body: EntryBody = {
			metadata: row.metadata,
			doc: readBodyDoc(row.doc, row.mdx),
			schemaVersion: row.schema_version,
			contentHash: row.content_hash,
			updatedAt: row.body_updated_at,
			translation: readTranslation(row.translation),
		};
		if (row.state === "working") working = body;
		else published = body;
	}
	if (!working) throw new CmsError("Entry missing working state", "invalid_state");

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
export async function lockEntryForUpdate(
	client: PoolClient,
	qSchema: string,
	id: string,
	expectedVersion?: number,
): Promise<LockedEntryRow> {
	const res = await client.query<LockedEntryRow>(
		`SELECT version, collection, locale, COALESCE(translation_group_id, id) AS translation_group_id,
		        status, updated_at, working_slug
		 FROM "${qSchema}".entries WHERE id = $1 FOR UPDATE`,
		[id],
	);
	const row = res.rows[0];
	if (!row) throw new CmsError("Entry not found", "not_found");
	if (expectedVersion !== undefined && row.version !== expectedVersion) {
		throw new CmsError("Conflict", "conflict", row.version);
	}
	return row;
}
