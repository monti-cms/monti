import type { Pool, PoolClient } from "pg";
import { problemError } from "../../../core/problem";
import { NO_FORMATS } from "../../../format/registry";
import type { Site } from "../../../site";
import { validateSchemaName, withTransaction } from "../store/context";
import { up as baseline } from "./0001_baseline";
import { up as mediaFolders } from "./0002_media_folders";
import { seedInitialBodyTemplates } from "./seed-initial-body-templates";
import type { MigrationContext, MigrationUp } from "./types";

/** One migration step. Once its name is recorded in `cms_migrations`, it does not run again. */
interface MigrationStep {
	readonly name: string;
	readonly up: MigrationUp;
}

/**
 * The schema steps, in the order they run. A change to the schema is a new file `NNNN_name.ts` in this folder with the next number, added at the end
 * of this list. Do not edit a step that has shipped: it does not run again on a store that already ran it.
 */
const STEPS: readonly MigrationStep[] = [
	{ name: "0001_baseline", up: baseline },
	{ name: "0002_media_folders", up: mediaFolders },
];

/** The name the seed job of the initial body templates is recorded under. */
const SEED_JOB = "seed_initial_body_templates";

/** List of step names (for tests and docs). */
export const CONTENT_STORE_MIGRATIONS: readonly string[] = STEPS.map((step) => step.name);

/** Takes a transaction lock so migrations on the same schema do not run concurrently. */
const lockMigrations = (client: PoolClient, qSchema: string) =>
	client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`cms_migrate:${qSchema}`]);

/** Creates the schema and the step record table (after taking the lock). */
export async function prepare(client: PoolClient, qSchema: string): Promise<void> {
	await lockMigrations(client, qSchema);
	await client.query(`CREATE SCHEMA IF NOT EXISTS "${qSchema}"`);
	await client.query(`
		CREATE TABLE IF NOT EXISTS "${qSchema}".cms_migrations (
			name TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`);
}

/** The error for a database built by an earlier pre-release of Monti, whose steps this version no longer has. */
export const databaseOutdatedError = () =>
	problemError(
		{
			what: "This database was created by an older pre-release of Monti and cannot be upgraded",
			where: "table cms_migrations",
			fix: "recreate it (run db:setup on a fresh schema or an empty database)",
		},
		undefined,
		"database_outdated",
	);

/**
 * Whether a record of `cms_migrations` is one this version knows: a core step, the seed job, or the record of a plugin's run-once job or a schema
 * transform (`plugin:...`, `schema:...`). Anything else with a number in front is a step of an earlier pre-release.
 */
export const isOutdatedMigrationName = (name: string): boolean =>
	/^\d{4}_/.test(name) && !CONTENT_STORE_MIGRATIONS.includes(name);

/**
 * Creates the schema or brings it up to date. Creates the schema if missing (the `schema` option), runs only the steps that have not run yet, in order, and then
 * the seed of the initial body templates if it has not run. It is one transaction, so a mid-way failure changes nothing, and concurrent runs on the same schema go
 * one at a time. A database whose record holds steps this version does not have (built by an older pre-release) is refused.
 */
export async function migrateContentStore(
	pool: Pool,
	options: { site: Site; schema?: string; formats?: MigrationContext["formats"] },
): Promise<{ applied: number; upToDate: number }> {
	const qSchema = validateSchemaName(options.schema);
	const context: MigrationContext = { site: options.site, formats: options.formats ?? NO_FORMATS };
	return withTransaction(pool, async (client) => {
		await prepare(client, qSchema);
		const applied = new Set(
			(await client.query<{ name: string }>(`SELECT name FROM "${qSchema}".cms_migrations`)).rows.map(
				(row) => row.name,
			),
		);
		if ([...applied].some(isOutdatedMigrationName)) throw databaseOutdatedError();
		let ran = 0;
		for (const step of STEPS) {
			if (applied.has(step.name)) continue;
			await step.up(client, qSchema, context);
			await client.query(`INSERT INTO "${qSchema}".cms_migrations (name) VALUES ($1)`, [step.name]);
			ran++;
		}
		if (!applied.has(SEED_JOB)) {
			await seedInitialBodyTemplates(client, qSchema, context);
			await client.query(`INSERT INTO "${qSchema}".cms_migrations (name) VALUES ($1)`, [SEED_JOB]);
		}
		return { applied: ran, upToDate: STEPS.length - ran };
	});
}

/**
 * Run-once job (for example, a plugin moving data). Calls `run` and records the name only when the name is not in `cms_migrations`.
 * It runs inside a transaction holding the same lock as the core migrations, so concurrent calls still run it once. A failure does not record the name.
 * Prefix the name with the plugin name so it never collides across the store (for example `ai:move-old-settings`).
 * @returns whether it ran this time
 */
export async function runOnce(
	pool: Pool,
	options: { schema?: string },
	name: string,
	run: (client: PoolClient) => Promise<void>,
): Promise<boolean> {
	const qSchema = validateSchemaName(options.schema);
	return withTransaction(pool, async (client) => {
		await prepare(client, qSchema);
		const done = await client.query(`SELECT 1 FROM "${qSchema}".cms_migrations WHERE name = $1`, [name]);
		if (done.rows.length > 0) return false;
		await run(client);
		await client.query(`INSERT INTO "${qSchema}".cms_migrations (name) VALUES ($1)`, [name]);
		return true;
	});
}
