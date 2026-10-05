import { register } from "node:module";
import path from "node:path";
import { CONFIG_ALIAS, resolveConfigPaths, SERVER_ALIAS } from "./config-paths";
import { loadEnvFiles } from "./env";

/** What the commands that run against the app's own configuration (`migrate`, `content:rewrite`) take. */
export interface AppOptions {
	readonly cwd: string;
	/** Env files to read. If unset, `.env.local` and `.env` (only those that exist); an empty array reads none. */
	readonly envFiles?: readonly string[];
	readonly config?: string;
	readonly server?: string;
	readonly log?: (message: string) => void;
}

/**
 * Reads env files and points the config aliases (`@cms-config`, `@cms-server`) at the app's files, so the core code that reads the site and server config
 * (loaded after this) sees the app's. TypeScript config files are read by tsx, which the command (`bin/monti.mjs`) registers first.
 */
export function loadApp(options: AppOptions): void {
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
}
