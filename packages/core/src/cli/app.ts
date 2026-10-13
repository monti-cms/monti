import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Cms } from "../cms";
import { problemError } from "../core/problem";
import type { AppFlags, CliContext } from "./command";
import { resolveConfigPath } from "./config-paths";
import { loadEnvFiles } from "./env";

/** What the commands that run against the app's own configuration (`db:migrate`, `events:retry`, ...) take: the context, and the app options. */
export interface AppOptions extends CliContext, AppFlags {
	/** Do not print the `env:` and `config:` lines (the commands that open with a line of their own). */
	readonly quiet?: boolean;
}

const isCms = (value: unknown): value is Cms =>
	typeof value === "object" &&
	value !== null &&
	typeof (value as Cms).migrate === "function" &&
	typeof (value as Cms).close === "function";

/**
 * Loads the config file (a path relative to `cwd`) and returns the CMS instance it exports (`export const cms = defineConfig({ ... })`, or as the default
 * export). TypeScript files are read by tsx, which the command (`bin/monti.mjs`) registers first. The environment must already hold the values the file reads.
 */
export async function importCms(cwd: string, configPath: string): Promise<Cms> {
	const configModule = (await import(pathToFileURL(path.resolve(cwd, configPath)).href)) as {
		cms?: unknown;
		default?: unknown;
	};
	const cms = configModule.cms ?? configModule.default;
	if (!isCms(cms)) {
		throw problemError({
			what: `${configPath} must export the CMS instance`,
			where: configPath,
			fix: "export it as `export const cms = defineConfig({ ... })` (defineConfig is exported by @monti-cms/core/server); `monti doctor` checks the rest of the setup",
		});
	}
	return cms;
}

/**
 * Reads env files, then loads the app's config file and returns the CMS instance it exports (see {@link importCms}).
 */
export async function loadApp(options: AppOptions): Promise<Cms> {
	const { log } = options;
	const loaded = loadEnvFiles(options.cwd, options.envFiles);
	if (loaded.length > 0 && !options.quiet) log(`env: ${loaded.join(", ")}`);
	const configPath = resolveConfigPath(options.cwd, options.config);
	if (!options.quiet) log(`config: ${configPath}`);
	return importCms(options.cwd, configPath);
}
