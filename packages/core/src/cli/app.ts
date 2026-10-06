import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Cms } from "../cms";
import { CONFIG_ALIAS, resolveConfigPaths } from "./config-paths";
import { loadEnvFiles } from "./env";

/** What the commands that run against the app's own configuration (`migrate`) take. */
export interface AppOptions {
	readonly cwd: string;
	/** Env files to read. If unset, `.env.local` and `.env` (only those that exist); an empty array reads none. */
	readonly envFiles?: readonly string[];
	/** Site config file. */
	readonly config?: string;
	/** Server file: the module that exports the CMS instance. */
	readonly server?: string;
	readonly log?: (message: string) => void;
}

const isCms = (value: unknown): value is Cms =>
	typeof value === "object" &&
	value !== null &&
	typeof (value as Cms).migrate === "function" &&
	typeof (value as Cms).close === "function";

/**
 * Reads env files, points the site config alias (`@cms-config`) at the app's file, then loads the app's server file and returns the CMS instance it exports
 * (`export const cms = createCms({ server })`, or as the default export). TypeScript files are read by tsx, which the command (`bin/monti.mjs`) registers first.
 */
export async function loadApp(options: AppOptions): Promise<Cms> {
	const log = options.log ?? console.log;
	const loaded = loadEnvFiles(options.cwd, options.envFiles);
	if (loaded.length > 0) log(`env: ${loaded.join(", ")}`);
	const paths = resolveConfigPaths(options.cwd, { config: options.config, server: options.server });
	log(`config: ${paths.config} · server: ${paths.server}`);
	const hooks = new URL(
		import.meta.url.endsWith(".ts") ? "../register-hooks.ts" : "../register-hooks.js",
		import.meta.url,
	);
	register(hooks, { data: { aliases: { [CONFIG_ALIAS]: path.resolve(options.cwd, paths.config) } } });
	const serverModule = (await import(pathToFileURL(path.resolve(options.cwd, paths.server)).href)) as {
		cms?: unknown;
		default?: unknown;
	};
	const cms = serverModule.cms ?? serverModule.default;
	if (!isCms(cms)) {
		throw new Error(
			`${paths.server} must export the CMS instance: \`export const cms = createCms({ server: defineServerConfig({ ... }) })\` (createCms is exported by @monti-cms/core/server)`,
		);
	}
	return cms;
}
