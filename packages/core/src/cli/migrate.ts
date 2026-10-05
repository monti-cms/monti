import { type AppOptions, loadApp } from "./app";

export type MigrateOptions = AppOptions;

/**
 * `monti migrate`: reads env files, points the config aliases (`@cms-config`, `@cms-server`) at the app's files, then creates the tables in the store.
 * TypeScript config files are read by tsx, which the command (`bin/monti.mjs`) registers first. Returns `true` on success.
 */
export async function migrate(options: MigrateOptions): Promise<boolean> {
	loadApp(options);
	const { runMigrate } = await import("../adapters/postgres/run-migrate");
	return runMigrate(options.log ?? console.log);
}
