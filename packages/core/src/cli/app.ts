import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Cms } from "../cms";
import { resolveServerPath } from "./config-paths";
import { loadEnvFiles } from "./env";

/** What the commands that run against the app's own configuration (`migrate`) take. */
export interface AppOptions {
	readonly cwd: string;
	/** Env files to read. If unset, `.env.local` and `.env` (only those that exist); an empty array reads none. */
	readonly envFiles?: readonly string[];
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
 * Reads env files, then loads the app's server file and returns the CMS instance it exports (`export const cms = createCms({ config, server })`, or as the
 * default export). The server file imports the site config itself. TypeScript files are read by tsx, which the command (`bin/monti.mjs`) registers first.
 */
export async function loadApp(options: AppOptions): Promise<Cms> {
	const log = options.log ?? console.log;
	const loaded = loadEnvFiles(options.cwd, options.envFiles);
	if (loaded.length > 0) log(`env: ${loaded.join(", ")}`);
	const serverPath = resolveServerPath(options.cwd, options.server);
	log(`server: ${serverPath}`);
	const serverModule = (await import(pathToFileURL(path.resolve(options.cwd, serverPath)).href)) as {
		cms?: unknown;
		default?: unknown;
	};
	const cms = serverModule.cms ?? serverModule.default;
	if (!isCms(cms)) {
		throw new Error(
			`${serverPath} must export the CMS instance: \`export const cms = createCms({ config, server: defineServerConfig({ ... }) })\` (createCms is exported by @monti-cms/core/server)`,
		);
	}
	return cms;
}
