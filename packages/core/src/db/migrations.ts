import { type Kysely, sql } from "kysely";
import { type Migration, Migrator } from "kysely/migration";
import type { Doc } from "../body/doc";
import { blockHashes } from "../translations/links";
import type { Database } from "./schema";

/** The core's tables, step by step. A step that reached the base branch is never renamed or changed; a change is a new step. */
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
			const published = await sql<{
				entry_id: string;
				doc: Doc | null;
			}>`select entry_id, doc from entry_published`.execute(db);
			for (const row of published.rows)
				await sql`update entry_published set block_hashes = ${JSON.stringify(blockHashes(row.doc))}::jsonb
					where entry_id = ${row.entry_id}`.execute(db);
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
			// Older databases could contain duplicate live sibling names. Keep the oldest and suffix the rest before adding the invariant.
			const rows = await db
				.selectFrom("folders")
				.select(["id", "collection", "parent_id", "name"])
				.where("trashed_at", "is", null)
				.orderBy("created_at")
				.orderBy("id")
				.execute();
			const names = new Map<string, Set<string>>();
			for (const row of rows) {
				const scope = `${row.collection ?? "\u0000"}\n${row.parent_id ?? "\u0000"}`;
				const taken = names.get(scope) ?? new Set<string>();
				let name = row.name;
				for (let suffix = 2; taken.has(name); suffix++) name = `${row.name} ${suffix}`;
				if (name !== row.name) await db.updateTable("folders").set({ name }).where("id", "=", row.id).execute();
				taken.add(name);
				names.set(scope, taken);
			}
			await sql`create unique index folders_live_sibling_name
				on folders (coalesce(collection, ''), coalesce(parent_id, ''), name)
				where trashed_at is null`.execute(db);
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
