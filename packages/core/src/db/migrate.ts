import { type Kysely, sql, type Transaction } from "kysely";
import type { Migration } from "./types";

/** Creates the history table, `(scope, name)` of every step that ran, when it is not there yet. */
async function ensureHistory<DB>(db: Kysely<DB>): Promise<void> {
	await db.schema
		.createTable("monti_migrations")
		.ifNotExists()
		.addColumn("scope", "text", (column) => column.notNull())
		.addColumn("name", "text", (column) => column.notNull())
		.addPrimaryKeyConstraint("monti_migrations_pkey", ["scope", "name"])
		.execute();
}

/** The names of the steps of `scope` that already ran. */
async function ranNames<DB>(db: Kysely<DB>, scope: string): Promise<Set<string>> {
	const { rows } = await sql<{ name: string }>`select name from monti_migrations where scope = ${scope}`.execute(db);
	return new Set(rows.map((row) => row.name));
}

/** Runs one step and records it in the same transaction, so a failed step leaves neither its changes nor its record. */
async function runStep<DB>(db: Kysely<DB>, scope: string, migration: Migration): Promise<void> {
	await db.transaction().execute(async (trx: Transaction<DB>) => {
		await migration.up(trx);
		await sql`insert into monti_migrations (scope, name) values (${scope}, ${migration.name})`.execute(trx);
	});
}

/**
 * Runs the steps of `scope` (`"core"` or a plugin's name) in the order of the array, each once: the steps already
 * recorded in `monti_migrations` for that scope are skipped. A failing step is rolled back and its error thrown;
 * the steps before it stay, the steps after it do not run.
 */
export async function migrate<DB>(db: Kysely<DB>, scope: string, migrations: readonly Migration[]): Promise<void> {
	await ensureHistory(db);
	const ran = await ranNames(db, scope);
	for (const migration of migrations) {
		if (ran.has(migration.name)) continue;
		await runStep(db, scope, migration);
	}
}
