import { type AppOptions, loadApp } from "./app";

export type MigrateOptions = AppOptions;

/**
 * `monti migrate`: reads env files, points the site config alias (`@cms-config`) at the app's file, loads the app's CMS instance and creates the tables in the store.
 * TypeScript files are read by tsx, which the command (`bin/monti.mjs`) registers first. Returns `true` on success.
 */
export async function migrate(options: MigrateOptions): Promise<boolean> {
	const cms = await loadApp(options);
	try {
		await cms.migrate({ log: options.log ?? console.log });
		return true;
	} catch (error) {
		console.error("Migration failed:", error);
		return false;
	} finally {
		await cms.close();
	}
}
