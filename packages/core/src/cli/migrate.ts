import { register } from "node:module";
import path from "node:path";
import { CONFIG_ALIAS, resolveConfigPaths, SERVER_ALIAS } from "./config-paths";
import { loadEnvFiles } from "./env";

export interface MigrateOptions {
	readonly cwd: string;
	/** Env files to read. If unset, `.env.local` and `.env` (only those that exist); an empty array reads none. */
	readonly envFiles?: readonly string[];
	readonly config?: string;
	readonly server?: string;
	readonly log?: (message: string) => void;
}

/**
 * `monti migrate`: reads env files, points the config aliases (`@cms-config`, `@cms-server`) at the app's files, then creates the tables in the store.
 * TypeScript config files are read by tsx, which the command (`bin/monti.mjs`) registers first. Returns `true` on success.
 */
export async function migrate(options: MigrateOptions): Promise<boolean> {
	const log = options.log ?? console.log;
	const loaded = loadEnvFiles(options.cwd, options.envFiles);
	if (loaded.length > 0) log(`env: ${loaded.join(", ")}`);
	const paths = resolveConfigPaths(options.cwd, { config: options.config, server: options.server });
	log(`config: ${paths.config} · server: ${paths.server}`);
	const hooks = new URL(
		import.meta.url.endsWith(".ts") ? "../register-hooks.ts" : "../register-hooks.js",
		import.meta.url,
	);
	register(hooks, {
		data: {
			aliases: {
				[CONFIG_ALIAS]: path.resolve(options.cwd, paths.config),
				[SERVER_ALIAS]: path.resolve(options.cwd, paths.server),
			},
		},
	});
	const { runMigrate } = await import("../adapters/postgres/run-migrate");
	return runMigrate(log);
}
