import { type AppOptions, loadApp } from "./app";

export type MigrateOptions = AppOptions;

/**
 * `monti db:migrate`: reads env files, loads the app's CMS instance (`monti.config.ts`) and brings the tables up to date with this version of Monti.
 * Nothing set up yet is not migrated: it says to run `monti db:setup` and returns `false`.
 * TypeScript files are read by tsx, which the command (`bin/monti.mjs`) registers first. Returns `true` on success.
 */
export async function dbMigrate(options: MigrateOptions): Promise<boolean> {
	const log = options.log ?? console.log;
	const cms = await loadApp({ ...options, quiet: true });
	try {
		const state = await cms.databaseState();
		if (state && !state.set) {
			console.error(
				`Monti is not set up in this database yet (schema "${state.schema}"). Run \`monti db:setup\` first; \`monti db:migrate\` is for after you update Monti.`,
			);
			return false;
		}
		await cms.migrate({ log });
		return true;
	} catch (error) {
		console.error("Migration failed:", error);
		return false;
	} finally {
		await cms.close();
	}
}

/**
 * `monti db:setup`: first-time setup. Creates the schema (when `DATABASE_SCHEMA` names one that is missing) and Monti's tables in an empty database.
 * When Monti's tables are already there it changes nothing and says so. Returns `true` on success.
 */
export async function dbSetup(options: AppOptions): Promise<boolean> {
	const cms = await loadApp({ ...options, quiet: true });
	try {
		await cms.setup({ log: options.log ?? console.log });
		return true;
	} catch (error) {
		console.error("Setup failed:", error);
		return false;
	} finally {
		await cms.close();
	}
}
