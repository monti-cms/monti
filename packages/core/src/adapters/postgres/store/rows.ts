import { type Selectable, sql } from "kysely";
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
import type { BodyTemplatesTable, ContentAddressesTable, FoldersTable, MediaAssetsTable } from "../db/database";
import type { Db } from "../db/kysely";

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

/** The columns of `content_addresses` the publish check reads. */
export type AddressRow = Pick<
	Selectable<ContentAddressesTable>,
	"collection" | "locale" | "slug" | "type" | "entry_id"
>;

export type FolderRow = Selectable<FoldersTable>;

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

/** A row of `media_assets` as `MEDIA_COLUMN_NAMES` selects it. */
export type MediaRow = Pick<Selectable<MediaAssetsTable>, (typeof MEDIA_COLUMN_NAMES)[number]>;

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

/** The columns of `body_templates` that make a `BodyTemplate` (the `mdx` column is no longer read). */
export type TemplateRow = Pick<
	Selectable<BodyTemplatesTable>,
	"id" | "name" | "doc" | "version" | "created_at" | "updated_at"
>;

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
	db: Db,
	entryId: string,
	state: "working" | "published",
	references: readonly Reference[],
): Promise<void> {
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

export async function readReferences(db: Db, entryId: string, state: "working" | "published"): Promise<Reference[]> {
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

export async function readBody(db: Db, entryId: string, state: "working" | "published"): Promise<BodyRow | undefined> {
	const row = await db
		.selectFrom("entry_bodies")
		.select(["metadata", "mdx", "doc", "schema_version", "content_hash", "updated_at", "translation"])
		.where("entry_id", "=", entryId)
		.where("state", "=", state)
		.executeTakeFirst();
	return row && { ...row, doc: readBodyDoc(row.doc, row.mdx), translation: readTranslation(row.translation) };
}

/** The value a conflicting insert of `entry_bodies` proposed (`EXCLUDED.<column>`), for the `DO UPDATE` of `writeBody`. */
const proposed = <T>(column: string) => sql.ref<T>(`excluded.${column}`);

/** Writes the working/published body. Also updates the plain text used for search. The `mdx` column is not written: `doc` is the only source of a body. */
export async function writeBody(
	site: Site,
	db: Db,
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
		.onConflict((conflict) =>
			conflict.columns(["entry_id", "state"]).doUpdateSet({
				metadata: proposed<string>("metadata"),
				doc: proposed<string>("doc"),
				schema_version: proposed<number>("schema_version"),
				content_hash: proposed<string>("content_hash"),
				updated_at: proposed<Date>("updated_at"),
				search_text: proposed<string>("search_text"),
				translation: proposed<string | null>("translation"),
			}),
		)
		.execute();
}

export async function loadEntry(db: Db, id: string): Promise<Entry> {
	const rows = await db
		.selectFrom("entries as e")
		.leftJoin("entry_bodies as b", "e.id", "b.entry_id")
		.select((eb) => [
			"e.id",
			"e.collection",
			"e.locale",
			sql<string>`coalesce(e.translation_group_id, e.id)`.as("translation_group_id"),
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
	if (!first) throw new CmsError("Entry not found", "not_found");

	let working: EntryBody | undefined;
	let published: EntryBody | undefined;
	for (const row of rows) {
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
export async function lockEntryForUpdate(db: Db, id: string, expectedVersion?: number): Promise<LockedEntryRow> {
	const row = await db
		.selectFrom("entries")
		.select([
			"version",
			"collection",
			"locale",
			sql<string>`coalesce(translation_group_id, id)`.as("translation_group_id"),
			"status",
			"updated_at",
			"working_slug",
		])
		.where("id", "=", id)
		.forUpdate()
		.executeTakeFirst();
	if (!row) throw new CmsError("Entry not found", "not_found");
	if (expectedVersion !== undefined && row.version !== expectedVersion) {
		throw new CmsError("Conflict", "conflict", row.version);
	}
	return row;
}
