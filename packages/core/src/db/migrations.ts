import { type Kysely, sql } from "kysely";
import { type Migration, Migrator } from "kysely/migration";

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
};

/** Brings the database up to the latest step (`monti db:setup`, `monti db:migrate`). */
export async function migrateToLatest(db: Kysely<unknown>): Promise<void> {
	const migrator = new Migrator({
		db,
		provider: { getMigrations: async () => MIGRATIONS },
		migrationTableName: "monti_migration",
		migrationLockTableName: "monti_migration_lock",
	});
	const { error, results } = await migrator.migrateToLatest();
	const failed = results?.find((result) => result.status === "Error");
	if (error || failed) throw new Error(`Migration ${failed?.migrationName ?? ""} failed`, { cause: error });
}
