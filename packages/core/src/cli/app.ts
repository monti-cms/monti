import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Cms } from "../cms";
import { resolveConfigPath } from "./config-paths";
import { loadEnvFiles } from "./env";

/** What the commands that run against the app's own configuration (`migrate`) take. */
export interface AppOptions {
	readonly cwd: string;
	/** Env files to read. If unset, `.env.local` and `.env` (only those that exist); an empty array reads none. */
	readonly envFiles?: readonly string[];
	/** Config file (`monti.config.ts`): the module that exports the CMS instance. */
	readonly config?: string;
	readonly log?: (message: string) => void;
}

const isCms = (value: unknown): value is Cms =>
	typeof value === "object" &&
	value !== null &&
	typeof (value as Cms).migrate === "function" &&
	typeof (value as Cms).close === "function";

/**
 * Reads env files, then loads the app's config file and returns the CMS instance it exports (`export const cms = defineConfig({ ... })`, or as the
 * default export). TypeScript files are read by tsx, which the command (`bin/monti.mjs`) registers first.
 */
export async function loadApp(options: AppOptions): Promise<Cms> {
	const log = options.log ?? console.log;
	const loaded = loadEnvFiles(options.cwd, options.envFiles);
	if (loaded.length > 0) log(`env: ${loaded.join(", ")}`);
	const configPath = resolveConfigPath(options.cwd, options.config);
	log(`config: ${configPath}`);
	const configModule = (await import(pathToFileURL(path.resolve(options.cwd, configPath)).href)) as {
		cms?: unknown;
		default?: unknown;
	};
	const cms = configModule.cms ?? configModule.default;
	if (!isCms(cms)) {
		throw new Error(
			`${configPath} must export the CMS instance: \`export const cms = defineConfig({ ... })\` (defineConfig of @monti-cms/core/server, not the one of @monti-cms/core)`,
		);
	}
	return cms;
}
