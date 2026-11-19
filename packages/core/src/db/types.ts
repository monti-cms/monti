import type { ColumnType, JSONColumnType, Kysely } from "kysely";

/** A `timestamptz` column: read as a `Date`, written as a `Date` or an ISO string. */
type Timestamp = ColumnType<Date, Date | string, Date | string>;

/** A nullable `timestamptz` column: read as `Date | null`, optional on insert. */
type NullableTimestamp = ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;

/** A nullable `uuid` column: read as `string | null`, optional on insert. */
type NullableUuid = ColumnType<string | null, string | null | undefined, string | null>;

/** A `jsonb` column holding a JSON object, written as its JSON text. */
type JsonObject = JSONColumnType<Record<string, unknown>>;

/** What an entry's locales share: its collection, the locale it was written in, its folder and whether it is trashed. */
export interface EntriesTable {
	id: string;
	collection: string;
	source_locale: string;
	folder_id: NullableUuid;
	trashed_at: NullableTimestamp;
}

/** The working copy of an entry in one locale. */
export interface EntryLocalesTable {
	entry_id: string;
	locale: string;
	slug: string;
	data: JsonObject;
	translation_seen: JsonObject;
}

/** The published copy of an entry in one locale, the one the site reads. */
export interface EntryPublishedTable {
	entry_id: string;
	locale: string;
	slug: string;
	data: JsonObject;
	published_at: Timestamp;
}

export interface TemplatesTable {
	id: string;
	collection: string;
	name: string;
	content: JsonObject;
}

/** `scope` is a collection key or `media`. */
export interface FoldersTable {
	id: string;
	scope: string;
	parent_id: NullableUuid;
	name: string;
	trashed_at: NullableTimestamp;
}

export interface MediaTable {
	id: string;
	folder_id: NullableUuid;
	key: string;
	mime_type: string;
	metadata: JsonObject;
	trashed_at: NullableTimestamp;
}

/** Where an entry or a template uses a media file. `source_id` is a logical reference, not a foreign key. */
export interface MediaUsesTable {
	media_id: string;
	source_kind: "entry" | "template";
	source_id: string;
	field_path: string;
}

/** Files in the storage that nothing uses any more, waiting to be removed. */
export interface LooseFilesTable {
	key: string;
	remove_after: Timestamp;
}

export interface MontiAdminTable {
	id: string;
	email: string;
	password_hash: string;
}

export interface MontiSessionTable {
	token_hash: string;
	admin_id: string;
	expires_at: Timestamp;
}

/** An external service key, kept encrypted in `secret`. */
export interface ApiKeysTable {
	id: string;
	service: string;
	name: string;
	secret: string;
	last4: string;
}

/** The eleven domain tables of the core. */
export interface Database {
	entries: EntriesTable;
	entry_locales: EntryLocalesTable;
	entry_published: EntryPublishedTable;
	templates: TemplatesTable;
	folders: FoldersTable;
	media: MediaTable;
	media_uses: MediaUsesTable;
	loose_files: LooseFilesTable;
	monti_admin: MontiAdminTable;
	monti_session: MontiSessionTable;
	api_keys: ApiKeysTable;
}

/**
 * One step of a database change. The core and every plugin list theirs in an array, run in order, each once.
 * `db` is untyped: a step works on the tables as they were at its time, not as they are now.
 */
export interface Migration {
	name: string;
	up: (db: Kysely<any>) => Promise<void>;
}
