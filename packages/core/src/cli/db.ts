import { type AppOptions, loadApp } from "./app";
import { appOptionsOf, defineCommand } from "./command";

export type MigrateOptions = AppOptions;

/**
 * `monti db:migrate`: reads env files, loads the app's CMS instance (`monti.config.ts`) and brings the tables up to date with this version of Monti.
 * Nothing set up yet is not migrated: it says to run `monti db:setup` and returns 1.
 * TypeScript files are read by tsx, which the command (`bin/monti.mjs`) registers first. Returns the exit code; an error (a database that cannot be reached, say) is thrown.
 */
export async function dbMigrate(options: MigrateOptions): Promise<number> {
	const cms = await loadApp({ ...options, quiet: true });
	try {
		const state = await cms.databaseState();
		if (state && !state.set) {
			options.error(
				`Monti is not set up in this database yet (schema "${state.schema}"). Run \`monti db:setup\` first; \`monti db:migrate\` is for after you update Monti.`,
			);
			return 1;
		}
		await cms.migrate({ log: options.log });
		return 0;
	} finally {
		await cms.close();
	}
}

/**
 * `monti db:setup`: first-time setup. Creates the schema (when `DATABASE_SCHEMA` names one that is missing) and Monti's tables in an empty database.
 * When Monti's tables are already there it changes nothing and says so. Returns the exit code; an error is thrown.
 */
export async function dbSetup(options: AppOptions): Promise<number> {
	const cms = await loadApp({ ...options, quiet: true });
	try {
		await cms.setup({ log: options.log });
		return 0;
	} finally {
		await cms.close();
	}
}

export const dbSetupCommand = defineCommand({
	name: "db:setup",
	summary: `First-time setup: create Monti's tables in the database of monti.config.ts (and the schema, when DATABASE_SCHEMA names one that is missing).
Run it once. When the tables are already there it changes nothing and says so`,
	options: {},
	app: true,
	run: (context) => dbSetup(appOptionsOf(context)),
});

export const dbMigrateCommand = defineCommand({
	name: "db:migrate",
	summary: `After you update Monti: bring the tables up to date with this version, and say where (host, database, schema) and how many steps ran.
When nothing is set up yet it tells you to run db:setup first`,
	options: {},
	app: true,
	run: (context) => dbMigrate(appOptionsOf(context)),
});
