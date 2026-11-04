import { type Kysely, sql } from "kysely";
import { type Migration, Migrator } from "kysely/migration";
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
};

/** Brings the database up to the latest step (`monti db:setup`, `monti db:migrate`). */
export async function migrateToLatest(db: Kysely<Database>): Promise<void> {
	const migrator = new Migrator({
		db: db as Kysely<unknown>,
		provider: { getMigrations: async () => MIGRATIONS },
		migrationTableName: "monti_migration",
		migrationLockTableName: "monti_migration_lock",
	});
	const { error, results } = await migrator.migrateToLatest();
	const failed = results?.find((result) => result.status === "Error");
	if (error || failed) throw new Error(`Migration ${failed?.migrationName ?? ""} failed`, { cause: error });
}
