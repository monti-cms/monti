import type { ColumnType, Generated, RawBuilder } from "kysely";
import type { Model } from "../keys/services";
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
	/** The run that made it (doc 10); `null` for one made without a run (a test, a later entry point). */
	run_id: string | null;
	request: string;
	status: "pending" | "applied" | "partial" | "discarded" | "reverted";
	/** While an apply is going: until when it holds the proposal, so two applies do not run at once. */
	applying_until: Date | null;
	created_at: Generated<Date>;
}

/**
 * `stale`: its record changed in the meantime. `skipped`: an item it depends on was left out or failed. `reverted`: applied, then put back.
 * An applied item that a revert left alone (its record changed since) stays `applied` with its reason.
 */
export type ProposalItemState = "pending" | "discarded" | "stale" | "applied" | "failed" | "skipped" | "reverted";

/** One exchange at a proposal item's own place (doc 10, 자리 요청): what the person asked of it, and what the assistant answered. */
export type ItemExchange = { request: string; answer: string; at: string };

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
	/** Whether the person keeps it in the proposal: left out, it is not applied (the review's check). */
	included: Generated<boolean>;
	/** The name the assistant gave the kind of change, shared by the items that belong together ("요약 채우기"). */
	group_label: Generated<string>;
	/** The versions its write left, by `recordKey`: a later item made from the same reading follows from here. */
	after_versions: Json<Record<string, number | null>> | null;
	thread: ColumnType<ItemExchange[], string | undefined, string>;
}

/** A conversation with the assistant (doc 10). */
export interface ConversationTable {
	id: string;
	/** The first thing asked, cut short. */
	title: string;
	/** The model the conversation runs on, picked in its input (doc 10): a key and one of its models. */
	key_id: string | null;
	model: string | null;
	thinking: string | null;
	created_at: Date;
	/** A conversation nobody opened for the kept days is removed. Opening it, or asking in it, counts from then again. */
	last_opened_at: Date;
}

export type RunStatus = "running" | "waiting" | "done" | "stopped" | "interrupted" | "failed";

/** One run: a request and the turns that answer it (doc 10). Its `context`, `usage`, `pending` and `ended` are the run engine's (`@monti-cms/ai`). */
export interface RunTable {
	id: string;
	conversation_id: string;
	/** `chat`: asked in the panel. `spot`: asked of one proposal item at its place. `again`: an item made again after its record changed. */
	kind: "chat" | "spot" | "again";
	/** `waiting`: the browser has screen tools to run before it goes on. `interrupted`: cut short by a limit or a lost connection; it can go on. */
	status: RunStatus;
	request: string;
	context: Json<unknown>;
	key_id: string | null;
	model: string;
	thinking: string;
	usage: Json<{ input: number; output: number }>;
	turns: Generated<number>;
	proposal_id: string | null;
	/** For `spot` and `again`: the proposal item it is about. */
	item_id: string | null;
	/** The turn that is not finished: its tool calls and the results that are in. */
	pending: Json<unknown> | null;
	/** Why and how it ended, for the panel. */
	ended: Json<unknown> | null;
	stop_requested: Generated<boolean>;
	/** While a request is running it: until when that request holds the run. */
	leased_until: Date | null;
	started_at: Date;
	ended_at: Date | null;
}

export interface RunMessageTable {
	id: string;
	run_id: string;
	position: number;
	message: Json<unknown>;
	created_at: Date;
}

export interface RunInboxTable {
	id: string;
	run_id: string;
	text: string;
	created_at: Date;
}

export interface AssistantSettingsTable {
	id: number;
	keep_days: number | null;
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

/** A service key (doc 14): sealed with `MONTI_SECRET`, so only the server reads it. */
export interface ApiKeyTable {
	id: string;
	service: string;
	/** Unique: the model menu groups models under it. */
	name: string;
	/** The service's address, for a service that asks for one (an OpenAI-compatible server). */
	base_url: string | null;
	secret: string;
	last4: string;
	/** The models the service listed for this key when it was last asked, and when that was. */
	models: ColumnType<Model[], string | undefined, string>;
	models_at: Date | null;
	/** When its service last failed to give a list: it is not asked again for a while (doc 14). Cleared by a list that came. */
	models_failed_at: Date | null;
	/** Raised by every change: a change made from an old reading is a conflict. */
	version: Generated<number>;
	created_at: ColumnType<Date, Date | undefined, never>;
}

/** Tokens a key's calls spent in one month (`2026-11`, UTC). */
export interface ApiKeyUsageTable {
	key_id: string;
	month: string;
	tokens: ColumnType<number | string, number, RawBuilder<unknown>>;
}

/** A model picked for a job. The one job is the quick tasks' (doc 14); the assistant's model is picked per conversation. */
export interface ModelChoiceTable {
	role: "quick";
	key_id: string;
	model: string;
}

export interface Database {
	api_keys: ApiKeyTable;
	api_key_usage: ApiKeyUsageTable;
	conversations: ConversationTable;
	runs: RunTable;
	run_messages: RunMessageTable;
	run_inbox: RunInboxTable;
	assistant_settings: AssistantSettingsTable;
	model_choices: ModelChoiceTable;
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
