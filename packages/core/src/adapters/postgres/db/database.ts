import type { ColumnType, Generated, GeneratedAlways } from "kysely";
import type { ContentChangeKind, EventDeliveryState } from "../../../core/store/events";
import type { EntryMetadata, EntryStatus, JsonObject } from "../../../core/store/types";

/**
 * The tables of the content store as Kysely sees them: one interface per table, one line per column, in the state the core migrations
 * (`store/schema.ts`, up to `0023_entry_changed_by`) leave a store in. It is written by hand and kept in this one file. `__test__/database-types.test.ts`
 * reads it and compares every table and column with `information_schema` of a freshly migrated schema, so a migration that adds or changes a column
 * cannot go in without this file changing with it.
 *
 * Rules the drift test relies on (keep each column on its own line, `name: Type;`):
 * - A `NOT NULL` column has no `| null`; a nullable column ends in `| null`.
 * - A column with a default (or a sequence) is `Generated<T>` or `GeneratedAlways<T>`; a nullable column may be left out of an insert either way.
 * - `Date` is `timestamptz`, `number` is `integer`, `Int8` is `bigint` (read back as a string by the driver), `Jsonb<T>` is `jsonb`, and `boolean` is `boolean`.
 *   Anything else (`string`, the string unions) is `text` or `uuid`.
 * - The shape of a JSONB value is the type argument of `Jsonb`. Where the stored shape is not trusted (it may be a legacy one), it is `unknown`,
 *   and the reader that owns the column validates it (`readDoc`, `readTranslation`, `readReferenceOccurrences`).
 *
 * The schema name is not here: `createDb` puts it on every table with `withSchema`.
 */

/** A `jsonb` column: read as `T` (the driver parses it), written as the JSON text (`JSON.stringify`, as every store write does). */
export type Jsonb<T> = ColumnType<T, string, string>;

/** A `bigint` column: the driver reads it as a string; either is accepted on write. */
export type Int8 = ColumnType<string, string | number | bigint, string | number | bigint>;

/** A `bigserial` column: a string when read, and never written. */
export type BigSerial = GeneratedAlways<string>;

/** What `cms_events.payload` holds (see `eventRowOf`). */
export interface EventPayload {
	translationGroupId: string;
	status: EntryStatus;
	publishedSlug: string | null;
	workingSlug: string | null;
}

export interface EntriesTable {
	id: string;
	collection: string;
	version: number;
	created_at: Date;
	updated_at: Date;
	first_published_at: Date | null;
	last_published_at: Date | null;
	published_at: Date | null;
	working_slug: string | null;
	folder_id: string | null;
	status: Generated<EntryStatus>;
	trashed_at: Date | null;
	locale: Generated<string>;
	translation_group_id: string | null;
	changed_by: string | null;
	changed_at: Date | null;
}

export interface EntryBodiesTable {
	entry_id: string;
	state: "working" | "published";
	metadata: Jsonb<EntryMetadata>;
	/** No longer written (`0020_mdx_columns_optional`); old rows may still hold the text. */
	mdx: string | null;
	schema_version: number;
	content_hash: string;
	updated_at: Date;
	search_text: Generated<string>;
	/** A translation state (`readTranslation` lifts old versions); `null` for a source. */
	translation: Jsonb<unknown> | null;
	/** The stored document (`readBodyDoc`); `null` or unreadable on a row older than stored documents. */
	doc: Jsonb<unknown> | null;
}

export interface ContentAddressesTable {
	collection: string;
	slug: string;
	entry_id: string | null;
	type: "reservation" | "current" | "alias" | "deleted";
	locale: Generated<string>;
}

export interface MediaAssetsTable {
	id: string;
	status: Generated<"pending" | "ready" | "failed" | "deleting">;
	filename: Generated<string>;
	mime_type: string | null;
	byte_size: Int8 | null;
	width: number | null;
	height: number | null;
	staging_key: string | null;
	storage_key: string | null;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
	ready_at: Date | null;
	default_alt: Generated<string>;
	default_caption: Generated<string>;
	original_staging_key: string | null;
	original_storage_key: string | null;
	original_mime_type: string | null;
	original_byte_size: Int8 | null;
	original_width: number | null;
	original_height: number | null;
}

export interface EntryReferencesTable {
	entry_id: string;
	state: "working" | "published";
	kind: "entry" | "media";
	target_id: string;
	target_entry_id: string | null;
	target_media_id: string | null;
	is_stale: boolean;
	/** As stored: a body occurrence may still be in an old shape (`readReferenceOccurrences` reads it). */
	occurrences: Jsonb<unknown>;
}

export interface FoldersTable {
	id: string;
	collection: string;
	parent_id: string | null;
	name: string;
	position: number;
	version: Generated<number>;
}

export interface UserPreferencesTable {
	user_id: string;
	preferences: Jsonb<JsonObject>;
	updated_at: Date;
}

export interface BodyTemplatesTable {
	id: string;
	name: string;
	/** No longer written (`0020_mdx_columns_optional`). */
	mdx: string | null;
	version: Generated<number>;
	created_at: Date;
	updated_at: Date;
	/** The stored document (`readDoc`); `null` on a row written by hand. */
	doc: Jsonb<unknown> | null;
}

export interface PluginDocumentsTable {
	plugin: string;
	collection: string;
	key: string;
	value: Jsonb<unknown>;
	version: Generated<number>;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export interface SchemaStateTable {
	id: Generated<boolean>;
	schema_version: number;
	schema: Jsonb<JsonObject>;
	applied_at: Generated<Date>;
}

export interface CmsEventsTable {
	seq: BigSerial;
	id: string;
	kind: ContentChangeKind;
	entry_id: string;
	collection: string;
	locale: string;
	content_hash: string | null;
	version: number;
	payload: Jsonb<EventPayload>;
	occurred_at: Generated<Date>;
}

export interface CmsEventDeliveriesTable {
	event_id: string;
	subscriber: string;
	state: EventDeliveryState;
	attempts: Generated<number>;
	last_error: string | null;
	last_attempt_at: Date | null;
	next_attempt_at: Date | null;
	locked_until: Date | null;
	delivered_at: Date | null;
}

export interface CmsMigrationsTable {
	name: string;
	applied_at: Generated<Date>;
}

/** Every table of a content store schema, by name. */
export interface Database {
	entries: EntriesTable;
	entry_bodies: EntryBodiesTable;
	content_addresses: ContentAddressesTable;
	media_assets: MediaAssetsTable;
	entry_references: EntryReferencesTable;
	folders: FoldersTable;
	user_preferences: UserPreferencesTable;
	body_templates: BodyTemplatesTable;
	plugin_documents: PluginDocumentsTable;
	schema_state: SchemaStateTable;
	cms_events: CmsEventsTable;
	cms_event_deliveries: CmsEventDeliveriesTable;
	cms_migrations: CmsMigrationsTable;
}
