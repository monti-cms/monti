import { type Kysely, sql } from "kysely";
import { type Migration, Migrator } from "kysely/migration";
import type { Database } from "./schema";

/**
 * The core's tables, step by step. A step that reached the base branch is never renamed or removed (a database records the names it ran); a change is a new step.
 * Monti has no users yet, so a step only shapes tables: it moves no stored data and fixes nothing an earlier version left (2026-11-10, owner).
 */
const MIGRATIONS: Record<string, Migration> = {
	"0001_kernel": {
		async up(db) {
			await db.schema
				.createTable("monti_activity")
				.addColumn("id", "text", (column) => column.primaryKey())
				.addColumn("at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
				.addColumn("actor", "jsonb", (column) => column.notNull())
				.addColumn("operation", "text", (column) => column.notNull())
				.addColumn("summary", "jsonb", (column) => column.notNull())
				.addColumn("targets", "jsonb", (column) => column.notNull())
				.addColumn("conversation_id", "text")
				.addColumn("proposal_item_id", "text")
				.addColumn("undo_until", "timestamptz")
				.addColumn("undone_at", "timestamptz")
				.execute();
			await db.schema.createIndex("monti_activity_at").on("monti_activity").column("at").execute();
			await db.schema
				.createTable("monti_activity_snapshot")
				.addColumn("activity_id", "text", (column) =>
					column.notNull().references("monti_activity.id").onDelete("cascade"),
				)
				.addColumn("kind", "text", (column) => column.notNull())
				.addColumn("record_id", "text", (column) => column.notNull())
				.addColumn("before", "jsonb")
				.addColumn("after_version", "integer")
				.addPrimaryKeyConstraint("monti_activity_snapshot_pk", ["activity_id", "kind", "record_id"])
				.execute();
			await db.schema
				.createTable("monti_delivery")
				.addColumn("id", "text", (column) => column.primaryKey())
				.addColumn("activity_id", "text", (column) => column.notNull().references("monti_activity.id"))
				.addColumn("destination", "text", (column) => column.notNull())
				.addColumn("event", "jsonb", (column) => column.notNull())
				.addColumn("state", "text", (column) =>
					column.notNull().check(sql`state in ('pending', 'sent', 'failed', 'canceled')`),
				)
				.addColumn("attempts", "integer", (column) => column.notNull().defaultTo(0))
				.addColumn("last_error", "text")
				.addColumn("next_attempt_at", "timestamptz")
				.addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
				.execute();
			await db.schema
				.createIndex("monti_delivery_state")
				.on("monti_delivery")
				.columns(["state", "next_attempt_at"])
				.execute();
			await db.schema
				.createTable("monti_proposal")
				.addColumn("id", "text", (column) => column.primaryKey())
				.addColumn("conversation_id", "text", (column) => column.notNull())
				.addColumn("request", "text", (column) => column.notNull())
				.addColumn("status", "text", (column) =>
					column.notNull().check(sql`status in ('pending', 'applied', 'partial', 'discarded')`),
				)
				.addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
				.execute();
			await db.schema
				.createTable("monti_proposal_item")
				.addColumn("id", "text", (column) => column.primaryKey())
				.addColumn("proposal_id", "text", (column) =>
					column.notNull().references("monti_proposal.id").onDelete("cascade"),
				)
				.addColumn("position", "integer", (column) => column.notNull())
				.addColumn("operation", "text", (column) => column.notNull())
				.addColumn("input", "jsonb", (column) => column.notNull())
				.addColumn("base_versions", "jsonb", (column) => column.notNull())
				.addColumn("state", "text", (column) =>
					column.notNull().check(sql`state in ('pending', 'discarded', 'stale', 'applied', 'failed', 'skipped')`),
				)
				.addColumn("reason", "jsonb")
				.addColumn("output", "jsonb")
				.addColumn("activity_id", "text")
				.execute();
		},
	},
	"0002_content": {
		async up(db) {
			await db.schema
				.createTable("entries")
				.addColumn("id", "text", (column) => column.primaryKey())
				.addColumn("collection", "text", (column) => column.notNull())
				.addColumn("translation_group", "text", (column) => column.notNull())
				.addColumn("locale", "text", (column) => column.notNull())
				.addColumn("slug", "text", (column) => column.notNull())
				.addColumn("title", "text", (column) => column.notNull().defaultTo(""))
				.addColumn("status", "text", (column) => column.notNull().defaultTo("draft"))
				.addColumn("version", "integer", (column) => column.notNull().defaultTo(1))
				.addColumn("folder_id", "text")
				.addColumn("values", "jsonb", (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
				.addColumn("doc", "jsonb")
				.addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
				.addColumn("updated_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
				.addColumn("trashed_at", "timestamptz")
				.execute();
			await db.schema.createIndex("entries_collection").on("entries").columns(["collection", "locale"]).execute();
			await db.schema.createIndex("entries_group").on("entries").column("translation_group").execute();
			await db.schema
				.createTable("entry_links")
				.addColumn("from_group", "text", (column) => column.notNull())
				.addColumn("field", "text", (column) => column.notNull())
				.addColumn("to_group", "text", (column) => column.notNull())
				.addColumn("position", "integer", (column) => column.notNull().defaultTo(0))
				.addPrimaryKeyConstraint("entry_links_pk", ["from_group", "field", "to_group"])
				.execute();
			await db.schema.createIndex("entry_links_to").on("entry_links").column("to_group").execute();
			await db.schema
				.createTable("schema_state")
				.addColumn("id", "integer", (column) => column.primaryKey().check(sql`id = 1`))
				.addColumn("version", "integer", (column) => column.notNull())
				.addColumn("applied_hash", "text", (column) => column.notNull())
				.addColumn("applied_schema", "jsonb", (column) => column.notNull())
				.addColumn("failed_change", "text")
				.execute();
			await db.schema
				.createTable("schema_changes")
				.addColumn("id", "text", (column) => column.primaryKey())
				.addColumn("applied_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
				.execute();
			await db.schema
				.createTable("collection_admin_values")
				.addColumn("collection", "text", (column) => column.primaryKey())
				.addColumn("values", "jsonb", (column) => column.notNull())
				.addColumn("version", "integer", (column) => column.notNull().defaultTo(1))
				.execute();
		},
	},
	"0003_lifecycle": {
		async up(db) {
			await db.schema
				.alterTable("entries")
				.addColumn("has_unpublished_changes", "boolean", (column) => column.notNull().defaultTo(false))
				.execute();
			await db.schema
				.alterTable("entries")
				.addCheckConstraint("entries_status", sql`status in ('draft', 'published', 'archived')`)
				.execute();
			await db.schema
				.createTable("entry_published")
				.addColumn("entry_id", "text", (column) => column.primaryKey().references("entries.id").onDelete("cascade"))
				.addColumn("collection", "text", (column) => column.notNull())
				.addColumn("locale", "text", (column) => column.notNull())
				.addColumn("title", "text", (column) => column.notNull())
				.addColumn("slug", "text", (column) => column.notNull())
				.addColumn("values", "jsonb", (column) => column.notNull())
				.addColumn("doc", "jsonb")
				.addColumn("published_at", "timestamptz", (column) => column.notNull())
				.addColumn("from_version", "integer", (column) => column.notNull())
				.execute();
			await db.schema
				.createIndex("entry_published_path")
				.on("entry_published")
				.columns(["collection", "locale", "slug"])
				.unique()
				.execute();
			await db.schema
				.createTable("old_paths")
				.addColumn("collection", "text", (column) => column.notNull())
				.addColumn("locale", "text", (column) => column.notNull())
				.addColumn("slug", "text", (column) => column.notNull())
				.addColumn("entry_id", "text", (column) => column.notNull().references("entries.id").onDelete("cascade"))
				.addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
				.addPrimaryKeyConstraint("old_paths_pk", ["collection", "locale", "slug"])
				.execute();
		},
	},
	"0004_templates": {
		async up(db) {
			await db.schema
				.createTable("templates")
				.addColumn("id", "text", (column) => column.primaryKey())
				.addColumn("name", "text", (column) => column.notNull())
				.addColumn("doc", "jsonb", (column) => column.notNull())
				.addColumn("version", "integer", (column) => column.notNull().defaultTo(1))
				.addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
				.addColumn("updated_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
				.execute();
		},
	},
	"0005_auth": {
		async up(db) {
			await db.schema
				.createTable("monti_admin")
				.addColumn("id", "integer", (column) => column.primaryKey().check(sql`id = 1`))
				.addColumn("email", "text", (column) => column.notNull())
				.addColumn("password_hash", "text", (column) => column.notNull())
				.addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
				.execute();
			await db.schema
				.createTable("monti_session")
				.addColumn("id", "text", (column) => column.primaryKey())
				.addColumn("token_hash", "text", (column) => column.notNull().unique())
				.addColumn("who", "text", (column) => column.notNull())
				.addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
				.addColumn("expires_at", "timestamptz", (column) => column.notNull())
				.execute();
			await db.schema
				.createTable("monti_sign_in_attempt")
				.addColumn("email", "text", (column) => column.notNull())
				.addColumn("at", "timestamptz", (column) => column.notNull())
				.execute();
			await db.schema
				.createIndex("monti_sign_in_attempt_email")
				.on("monti_sign_in_attempt")
				.columns(["email", "at"])
				.execute();
		},
	},
	"0006_list": {
		async up(db) {
			// Search finds Korean too, so it uses trigram indexes (doc 06). The extension is the database's, shared by every site in it: use it where
			// another site put it, or put it in `public`.
			const found = await sql<{
				schema: string;
			}>`select extnamespace::regnamespace::text as schema from pg_extension where extname = 'pg_trgm'`.execute(db);
			const trgm = found.rows[0]?.schema ?? "public";
			if (found.rows.length === 0)
				await sql`create extension if not exists pg_trgm with schema ${sql.id(trgm)}`.execute(db);
			// The body's text, taken from its blocks when it is saved, so search reads one column (doc 06, decisions).
			await sql`alter table entries add column body_text text generated always as
				(jsonb_path_query_array(doc, 'strict $.**.text', '{}', true)::text) stored`.execute(db);
			for (const column of ["title", "slug", "body_text"])
				await sql`create index ${sql.id(`entries_${column}_trgm`)} on entries using gin (${sql.id(column)} ${sql.id(trgm, "gin_trgm_ops")})`.execute(
					db,
				);
		},
	},
	"0007_translations": {
		async up(db) {
			// One entry per language in a group (doc 04); a trashed one makes room for a new one.
			await sql`create unique index entries_group_locale on entries (translation_group, locale) where trashed_at is null`.execute(
				db,
			);
			// Source blocks a translation chose to leave out, so they are not offered as new again.
			await db.schema
				.alterTable("entries")
				.addColumn("translation_skips", "jsonb", (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
				.execute();
			// Each published top-level block's hash by id: what a translation's marks are counted against.
			await db.schema
				.alterTable("entry_published")
				.addColumn("block_hashes", "jsonb", (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
				.execute();
			// A source block as it was when a translation saw it, by its hash: the "before" of a changed mark.
			await db.schema
				.createTable("source_blocks")
				.addColumn("hash", "text", (column) => column.primaryKey())
				.addColumn("block", "jsonb", (column) => column.notNull())
				.execute();
		},
	},
	"0008_folders": {
		async up(db) {
			// Boxes for sorting entries and media in the admin (doc 07): one tree per collection, and one for media (`collection` null).
			await db.schema
				.createTable("folders")
				.addColumn("id", "text", (column) => column.primaryKey())
				.addColumn("collection", "text")
				.addColumn("parent_id", "text")
				.addColumn("name", "text", (column) => column.notNull())
				.addColumn("position", "integer", (column) => column.notNull().defaultTo(0))
				.addColumn("version", "integer", (column) => column.notNull().defaultTo(1))
				.addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
				.addColumn("trashed_at", "timestamptz")
				.execute();
			await db.schema.createIndex("folders_parent").on("folders").columns(["collection", "parent_id"]).execute();
			await db.schema.createIndex("entries_folder").on("entries").column("folder_id").execute();
		},
	},
	"0009_relations": {
		async up(db) {
			await db.schema
				.alterTable("entries")
				.addColumn("position", "integer", (column) => column.notNull().defaultTo(0))
				.execute();
			await db.schema.createIndex("entries_position").on("entries").columns(["collection", "position"]).execute();
		},
	},
	"0010_folder_names": {
		async up(db) {
			// Two live folders side by side never share a name.
			await sql`create unique index folders_live_sibling_name
				on folders (coalesce(collection, ''), coalesce(parent_id, ''), name)
				where trashed_at is null`.execute(db);
		},
	},
	"0011_media": {
		async up(db) {
			// The media library (doc 09). A key is written once and belongs to one file.
			await db.schema
				.createTable("media")
				.addColumn("id", "text", (column) => column.primaryKey())
				.addColumn("folder_id", "text")
				.addColumn("name", "text", (column) => column.notNull())
				.addColumn("kind", "text", (column) => column.notNull())
				.addColumn("mime", "text", (column) => column.notNull())
				.addColumn("size", "integer", (column) => column.notNull())
				.addColumn("original_key", "text", (column) => column.notNull().unique())
				.addColumn("original_width", "integer")
				.addColumn("original_height", "integer")
				.addColumn("web_key", "text", (column) => column.unique())
				.addColumn("web_width", "integer")
				.addColumn("web_height", "integer")
				.addColumn("uploaded_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
				.addColumn("version", "integer", (column) => column.notNull().defaultTo(1))
				.addColumn("trashed_at", "timestamptz")
				.execute();
			await db.schema.createIndex("media_folder").on("media").column("folder_id").execute();
			// Who uses a file: one owner, an entry or a template, gone with its owner (a purge, a removed collection).
			await db.schema
				.createTable("media_uses")
				.addColumn("media_id", "text", (column) => column.notNull().references("media.id").onDelete("cascade"))
				.addColumn("entry_id", "text", (column) => column.references("entries.id").onDelete("cascade"))
				.addColumn("template_id", "text", (column) => column.references("templates.id").onDelete("cascade"))
				.addColumn("place", "text", (column) => column.notNull())
				.addCheckConstraint("media_uses_one_owner", sql`(entry_id is null) <> (template_id is null)`)
				.execute();
			await sql`create unique index media_uses_place
				on media_uses (media_id, coalesce(entry_id, ''), coalesce(template_id, ''), place)`.execute(db);
			await db.schema.createIndex("media_uses_entry").on("media_uses").column("entry_id").execute();
			await db.schema.createIndex("media_uses_template").on("media_uses").column("template_id").execute();
		},
	},
	"0012_translation_seen": {
		async up(db) {
			// What a translation has seen of its source's fields (T111): a mark needs a value it saw.
			await db.schema
				.alterTable("entries")
				.addColumn("translation_seen", "jsonb", (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
				.execute();
		},
	},
	"0013_media_placeholder": {
		async up(db) {
			// A picture's blurred stand-in for the site (doc 09), made by the browser with its web size.
			await db.schema.alterTable("media").addColumn("placeholder", "text").execute();
		},
	},
	"0014_trash": {
		async up(db) {
			// The trash (doc 11): who threw it away, the paths a deleted entry leaves taken, and files waiting to leave the storage.
			await db.schema.alterTable("entries").addColumn("trashed_by", "text").execute();
			await db.schema.alterTable("folders").addColumn("trashed_by", "text").execute();
			await db.schema.alterTable("media").addColumn("trashed_by", "text").execute();
			await db.schema.createIndex("entries_trashed").on("entries").column("trashed_at").execute();
			await db.schema
				.createTable("reserved_paths")
				.addColumn("collection", "text", (column) => column.notNull())
				.addColumn("locale", "text", (column) => column.notNull())
				.addColumn("slug", "text", (column) => column.notNull())
				.addColumn("since", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
				.addPrimaryKeyConstraint("reserved_paths_pk", ["collection", "locale", "slug"])
				.execute();
			await db.schema
				.createTable("loose_files")
				.addColumn("key", "text", (column) => column.primaryKey())
				.addColumn("remove_after", "timestamptz", (column) => column.notNull())
				.execute();
		},
	},
	"0015_keys": {
		async up(db) {
			// Service keys (doc 14): the key sealed with MONTI_SECRET, its last four characters to show, the models its service listed, and its version.
			await db.schema
				.createTable("api_keys")
				.addColumn("id", "text", (column) => column.primaryKey())
				.addColumn("service", "text", (column) => column.notNull())
				.addColumn("name", "text", (column) => column.notNull().unique())
				.addColumn("base_url", "text")
				.addColumn("secret", "text", (column) => column.notNull())
				.addColumn("last4", "text", (column) => column.notNull())
				.addColumn("models", "jsonb", (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
				.addColumn("models_at", "timestamptz")
				.addColumn("models_failed_at", "timestamptz")
				.addColumn("version", "integer", (column) => column.notNull().defaultTo(1))
				.addColumn("created_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
				.execute();
			// Tokens per key and month: a count that comes late for last month does not touch this month's.
			await db.schema
				.createTable("api_key_usage")
				.addColumn("key_id", "text", (column) => column.notNull().references("api_keys.id").onDelete("cascade"))
				.addColumn("month", "text", (column) => column.notNull())
				.addColumn("tokens", "bigint", (column) => column.notNull())
				.addPrimaryKeyConstraint("api_key_usage_pk", ["key_id", "month"])
				.execute();
			// The one model the keys screen picks: the quick tasks'. It goes with its key.
			await db.schema
				.createTable("model_choices")
				.addColumn("role", "text", (column) => column.primaryKey().check(sql`role in ('quick')`))
				.addColumn("key_id", "text", (column) => column.notNull().references("api_keys.id").onDelete("cascade"))
				.addColumn("model", "text", (column) => column.notNull())
				.execute();
		},
	},
	"0016_assistant": {
		async up(db) {
			// The assistant (doc 10): conversations, their runs and what was said in them. The core keeps the tables, since proposals, the activity log
			// and the trash point at conversations; what runs a conversation is `@monti-cms/ai`.
			await db.schema
				.createTable("conversations")
				.addColumn("id", "text", (column) => column.primaryKey())
				.addColumn("title", "text", (column) => column.notNull())
				.addColumn("key_id", "text")
				.addColumn("model", "text")
				.addColumn("thinking", "text")
				.addColumn("created_at", "timestamptz", (column) => column.notNull())
				.addColumn("last_opened_at", "timestamptz", (column) => column.notNull())
				.execute();
			await db.schema
				.createTable("runs")
				.addColumn("id", "text", (column) => column.primaryKey())
				.addColumn("conversation_id", "text", (column) =>
					column.notNull().references("conversations.id").onDelete("cascade"),
				)
				.addColumn("kind", "text", (column) => column.notNull().check(sql`kind in ('chat', 'spot', 'again')`))
				.addColumn("status", "text", (column) =>
					column.notNull().check(sql`status in ('running', 'waiting', 'done', 'stopped', 'interrupted', 'failed')`),
				)
				.addColumn("request", "text", (column) => column.notNull())
				.addColumn("context", "jsonb", (column) => column.notNull())
				.addColumn("key_id", "text")
				.addColumn("model", "text", (column) => column.notNull())
				.addColumn("thinking", "text", (column) => column.notNull())
				.addColumn("usage", "jsonb", (column) => column.notNull())
				.addColumn("turns", "integer", (column) => column.notNull().defaultTo(0))
				.addColumn("turns_from", "integer", (column) => column.notNull().defaultTo(0))
				.addColumn("tokens_from", "integer", (column) => column.notNull().defaultTo(0))
				.addColumn("size", "integer", (column) => column.notNull().defaultTo(0))
				.addColumn("position", "integer", (column) => column.notNull())
				.addColumn("lease_token", "text")
				.addColumn("proposal_id", "text")
				.addColumn("item_id", "text")
				.addColumn("pending", "jsonb")
				.addColumn("ended", "jsonb")
				.addColumn("stop_requested", "boolean", (column) => column.notNull().defaultTo(false))
				.addColumn("leased_until", "timestamptz")
				.addColumn("started_at", "timestamptz", (column) => column.notNull())
				.addColumn("ended_at", "timestamptz")
				.execute();
			await db.schema.createIndex("runs_conversation").on("runs").columns(["conversation_id", "started_at"]).execute();
			// One chat run at a time in a conversation (doc 10): the database holds the rule, so two requests cannot both start one.
			await sql`create unique index runs_one_chat on runs (conversation_id)
				where kind = 'chat' and status in ('running', 'waiting')`.execute(db);
			await db.schema
				.createTable("run_messages")
				.addColumn("id", "text", (column) => column.primaryKey())
				.addColumn("run_id", "text", (column) => column.notNull().references("runs.id").onDelete("cascade"))
				.addColumn("position", "integer", (column) => column.notNull())
				.addColumn("message", "jsonb", (column) => column.notNull())
				.addColumn("created_at", "timestamptz", (column) => column.notNull())
				.addUniqueConstraint("run_messages_position", ["run_id", "position"])
				.execute();
			// What the person says while a run is going: taken into its next turn, or left for the next run.
			await db.schema
				.createTable("run_inbox")
				.addColumn("id", "text", (column) => column.primaryKey())
				.addColumn("run_id", "text", (column) => column.notNull().references("runs.id").onDelete("cascade"))
				.addColumn("text", "text", (column) => column.notNull())
				.addColumn("created_at", "timestamptz", (column) => column.notNull())
				.execute();
			// After how many days a conversation nobody opened is removed; one row, `null` days keeps them.
			await db.schema
				.createTable("assistant_settings")
				.addColumn("id", "integer", (column) => column.primaryKey().check(sql`id = 1`))
				.addColumn("keep_days", "integer")
				.execute();
			// A proposal belongs to the run that made it; its items carry the group the assistant named, whether the person keeps them, the versions
			// their write left (so an apply cut short goes on from there) and what was asked of them at their place.
			await db.schema.alterTable("monti_proposal").addColumn("run_id", "text").execute();
			await db.schema.alterTable("monti_proposal").addColumn("applying_until", "timestamptz").execute();
			await db.schema.alterTable("monti_proposal").addColumn("applying_token", "text").execute();
			// A run has one proposal: asked for twice (a run cut between making it and noting it), the second finds the first.
			await sql`create unique index monti_proposal_run on monti_proposal (run_id) where run_id is not null`.execute(db);
			await sql`alter table monti_proposal drop constraint monti_proposal_status_check`.execute(db);
			await sql`alter table monti_proposal add constraint monti_proposal_status_check
				check (status in ('pending', 'applied', 'partial', 'discarded', 'reverted'))`.execute(db);
			await db.schema
				.alterTable("monti_proposal_item")
				.addColumn("included", "boolean", (column) => column.notNull().defaultTo(true))
				.execute();
			await db.schema
				.alterTable("monti_proposal_item")
				.addColumn("group_label", "text", (column) => column.notNull().defaultTo(""))
				.execute();
			await db.schema.alterTable("monti_proposal_item").addColumn("after_versions", "jsonb").execute();
			await db.schema.alterTable("monti_proposal_item").addColumn("from_versions", "jsonb").execute();
			await db.schema.alterTable("monti_proposal_item").addColumn("made_by", "text").execute();
			await db.schema.alterTable("monti_proposal_item").addColumn("origin", "text").execute();
			await db.schema.alterTable("monti_proposal_item").addColumn("preview", "jsonb").execute();
			await db.schema
				.alterTable("monti_proposal_item")
				.addColumn("thread", "jsonb", (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
				.execute();
			await sql`alter table monti_proposal_item drop constraint monti_proposal_item_state_check`.execute(db);
			await sql`alter table monti_proposal_item add constraint monti_proposal_item_state_check
				check (state in ('pending', 'discarded', 'stale', 'applied', 'failed', 'skipped', 'reverted'))`.execute(db);
			await db.schema
				.createIndex("monti_proposal_conversation")
				.on("monti_proposal")
				.column("conversation_id")
				.execute();
		},
	},
};

/** How many times a migration is tried when it only lost a race with another schema's table changes. */
const RACE_TRIES = 30;

/** Brings the database up to the latest step (`monti db:setup`, `monti db:migrate`). */
export async function migrateToLatest(db: Kysely<Database>): Promise<void> {
	// Named, because the migrator otherwise looks for its tables in every schema and takes another schema's (a second site in the same database).
	const { rows } = await sql<{ schema: string }>`select current_schema() as schema`.execute(db);
	const migrator = new Migrator({
		db: db as Kysely<unknown>,
		provider: { getMigrations: async () => MIGRATIONS },
		migrationTableName: "monti_migration",
		migrationLockTableName: "monti_migration_lock",
		migrationTableSchema: rows[0].schema,
	});
	// Before it runs a step, the migrator lists every table in the database and reads each one. When another site (another schema) drops or
	// changes a table between the list and the read, Postgres answers "relation does not exist" (42P01) or "column does not exist" (42703) about
	// that other schema's table. No step has run yet, so trying again is safe; a step of ours that fails is not retried. The more tables the
	// database holds, the longer the list takes and the likelier the race (CI's shared database lost five tries in a row), so the tries are many and
	// spread out a little.
	for (let attempt = 1; ; attempt++) {
		const { error, results } = await migrator.migrateToLatest();
		const failed = results?.find((result) => result.status === "Error");
		if (!error && !failed) return;
		if (!failed && attempt < RACE_TRIES && racedWithAnotherSchema(error, rows[0].schema)) {
			await new Promise((resume) => setTimeout(resume, Math.random() * 20 * attempt));
			continue;
		}
		throw new Error(`Migration ${failed?.migrationName ?? ""} failed`, { cause: error });
	}
}

/** Whether the migrator's table listing lost a race with another schema's DDL (see `migrateToLatest`). */
function racedWithAnotherSchema(error: unknown, schema: string): boolean {
	const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
	// A whole schema dropped between the list and the read (another site removed, or a test run cleaning up) is 3F000 about that schema.
	if (code === "3F000") {
		const gone = typeof message === "string" ? /schema "([^"]+)" does not exist/.exec(message) : null;
		return gone !== null && gone[1] !== schema;
	}
	if (code !== "42P01" && code !== "42703") return false;
	// A relation named with its schema is another site's; a bare name or ours could be a step of our own.
	const named = typeof message === "string" ? /relation "([^".]+)\.[^"]+"/.exec(message) : null;
	return code === "42703" || (named !== null && named[1] !== schema);
}
