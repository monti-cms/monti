import type { ColumnType, Generated } from "kysely";
import type { Actor, Message, MontiEvent, RecordRef } from "../operation";
import type { AdminValues } from "../schema/admin-values";
import type { Schema } from "../schema/define";

type Json<T> = ColumnType<T, string, string>;

/** One row per write: who, what, and whether it can still be undone. */
export interface ActivityTable {
	id: string;
	at: Generated<Date>;
	actor: Json<Actor>;
	operation: string;
	summary: Json<Message>;
	targets: Json<RecordRef[]>;
	conversation_id: string | null;
	proposal_item_id: string | null;
	/** Until when undo works (30 days); null when the write cannot be undone. */
	undo_until: Date | null;
	undone_at: Date | null;
}

/** A record's state before a write and its version after it. `before` is null for a record the write created; `after_version` null when it removed one. */
export interface ActivitySnapshotTable {
	activity_id: string;
	kind: string;
	record_id: string;
	before: Json<unknown> | null;
	after_version: number | null;
}

/** An event to send to one receiver, queued in the write's transaction and sent after it commits. */
export interface DeliveryTable {
	id: string;
	activity_id: string;
	destination: string;
	event: Json<MontiEvent>;
	state: "pending" | "sent" | "failed" | "canceled";
	attempts: Generated<number>;
	last_error: string | null;
	next_attempt_at: Date | null;
	created_at: Generated<Date>;
}

export interface ProposalTable {
	id: string;
	conversation_id: string;
	request: string;
	status: "pending" | "applied" | "partial" | "discarded";
	created_at: Generated<Date>;
}

export type ProposalItemState = "pending" | "discarded" | "stale" | "applied" | "failed" | "skipped";

/** One write the assistant proposed: the operation, its input, and the versions it read. */
export interface ProposalItemTable {
	id: string;
	proposal_id: string;
	position: number;
	operation: string;
	input: Json<unknown>;
	base_versions: Json<Record<string, number>>;
	state: ProposalItemState;
	reason: Json<Message> | null;
	output: Json<unknown> | null;
	activity_id: string | null;
}

/** Every collection's entries in one table (doc 01, D1). Field values sit in `values`; system values the list sorts and filters by are columns. */
export interface EntryTable {
	id: string;
	collection: string;
	translation_group: string;
	locale: string;
	slug: string;
	title: Generated<string>;
	status: Generated<EntryStatus>;
	/** Published, and the working copy differs from what the site shows ("changed" in the list). */
	has_unpublished_changes: Generated<boolean>;
	version: Generated<number>;
	position: Generated<number>;
	folder_id: string | null;
	values: ColumnType<Record<string, unknown>, string | undefined, string>;
	doc: Json<unknown> | null;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
	trashed_at: Date | null;
	/** In the trash: who threw it away. */
	trashed_by: TrashedBy | null;
	/** In a translation: source block ids it chose to leave out, so they are not marked as new (doc 04). */
	translation_skips: ColumnType<string[], string | undefined, string>;
	/** In a translation: the source's value of each field holding its own, as it saw it. A field's mark is the source moving on from this. */
	translation_seen: ColumnType<Record<string, unknown>, string | undefined, string>;
	/** The body's text, made by the database from the blocks (search reads it). */
	body_text: ColumnType<string | null, never, never>;
}

/** Who put something in the trash: the trash marks what the assistant threw away (doc 11). */
export type TrashedBy = "admin" | "assistant" | "cli" | "plugin";

/** `draft` was never published; `archived` was taken off the site (doc 02). "Changed" is `published` with `has_unpublished_changes`. */
export type EntryStatus = "draft" | "published" | "archived";

/** What the site shows of an entry: a copy of its working version made when it was published (doc 02). The site reads only this table. */
export interface EntryPublishedTable {
	entry_id: string;
	collection: string;
	locale: string;
	title: string;
	slug: string;
	values: Json<Record<string, unknown>>;
	doc: Json<unknown> | null;
	published_at: Date;
	/** The entry version it was copied from. */
	from_version: number;
	/** Each top-level block's hash by block id: a translation's marks are counted against these (doc 04). */
	block_hashes: ColumnType<Record<string, string>, string | undefined, string>;
}

/** A source block as a translation saw it, by its hash: the "before" a changed mark shows (doc 04). */
export interface SourceBlockTable {
	hash: string;
	block: Json<unknown>;
}

/** A slug an entry was published under before; the site sends it on to the entry's slug now. */
export interface OldPathTable {
	collection: string;
	locale: string;
	slug: string;
	entry_id: string;
	created_at: Generated<Date>;
}

/** A body template (doc 03): one list for the whole site, an admin value editable on the live site. */
export interface TemplateTable {
	id: string;
	name: string;
	doc: Json<unknown>;
	version: Generated<number>;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

/** A relation value between translation groups (doc 08). */
export interface EntryLinkTable {
	from_group: string;
	field: string;
	to_group: string;
	position: Generated<number>;
}

/** The schema this database last followed: compared with the file to find hand edits. */
export interface SchemaStateTable {
	id: number;
	version: number;
	applied_hash: string;
	applied_schema: Json<Schema>;
	/** A change file whose database step failed after its files were written (doc 12: the "apply again" button). */
	failed_change: string | null;
}

export interface SchemaChangeTable {
	id: string;
	applied_at: Generated<Date>;
}

export interface CollectionAdminValuesTable {
	collection: string;
	values: Json<AdminValues>;
	version: Generated<number>;
}

/** The one admin (doc 15). The password way has an email and a hash; the GitHub way names its account in the config file, not here. */
export interface AdminTable {
	id: number;
	email: string;
	password_hash: string;
	created_at: Generated<Date>;
}

/** A signed-in browser. The cookie holds a token; the table holds its hash, so a leaked table opens nothing. */
export interface SessionTable {
	id: string;
	token_hash: string;
	/** Who signed in: the admin's email, or `github:<login>`. */
	who: string;
	created_at: Generated<Date>;
	expires_at: Date;
}

/** A failed sign-in, counted per email for the one-minute lock. */
export interface SignInAttemptTable {
	email: string;
	at: Date;
}

/** A folder (doc 07): a box in the admin, never on the site. `collection` is the collection whose entries it holds; `null` holds media. */
export interface FolderTable {
	id: string;
	collection: string | null;
	/** `null` is the top level. */
	parent_id: string | null;
	/** Unique among its siblings. */
	name: string;
	position: Generated<number>;
	version: Generated<number>;
	created_at: Generated<Date>;
	trashed_at: Date | null;
	trashed_by: TrashedBy | null;
}

/** A file in the media library (doc 09): the bytes are in the storage under its keys. */
export interface MediaTable {
	id: string;
	/** `null` is the top level of the library. */
	folder_id: string | null;
	name: string;
	kind: "image" | "file";
	mime: string;
	size: number;
	original_key: string;
	original_width: number | null;
	original_height: number | null;
	/** The web size, for an image whose original is larger; the site and the model read it. */
	web_key: string | null;
	web_width: number | null;
	web_height: number | null;
	/** A picture 20px on its long side, as a data URL, for a site to show blurred until the picture comes (doc 09). */
	placeholder: string | null;
	uploaded_at: Generated<Date>;
	version: Generated<number>;
	trashed_at: Date | null;
	trashed_by: TrashedBy | null;
}

/** A path an entry was once published under, kept after the entry is deleted for good: no other entry takes it (doc 11). */
export interface ReservedPathTable {
	collection: string;
	locale: string;
	slug: string;
	since: Generated<Date>;
}

/** A file in the storage that no media row holds: an upload that never became an item, a replaced file, a deleted one. The clean-up removes it (doc 11). */
export interface LooseFileTable {
	key: string;
	remove_after: Date;
}

/** One place a file is used: one field or one body block of an entry or a template. Written again whenever its owner changes (doc 09). */
export interface MediaUseTable {
	media_id: string;
	entry_id: string | null;
	template_id: string | null;
	/** `field:<name>` or `block:<id>`. */
	place: string;
}

export interface Database {
	entries: EntryTable;
	folders: FolderTable;
	media: MediaTable;
	media_uses: MediaUseTable;
	entry_published: EntryPublishedTable;
	source_blocks: SourceBlockTable;
	old_paths: OldPathTable;
	reserved_paths: ReservedPathTable;
	loose_files: LooseFileTable;
	templates: TemplateTable;
	monti_admin: AdminTable;
	monti_session: SessionTable;
	monti_sign_in_attempt: SignInAttemptTable;
	entry_links: EntryLinkTable;
	schema_state: SchemaStateTable;
	schema_changes: SchemaChangeTable;
	collection_admin_values: CollectionAdminValuesTable;
	monti_activity: ActivityTable;
	monti_activity_snapshot: ActivitySnapshotTable;
	monti_delivery: DeliveryTable;
	monti_proposal: ProposalTable;
	monti_proposal_item: ProposalItemTable;
}
