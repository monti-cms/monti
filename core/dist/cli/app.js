import path from "node:path";
import { pathToFileURL } from "node:url";
import { problemError } from "../core/problem.js";
import { resolveConfigPath } from "./config-paths.js";
import { loadEnvFiles } from "./env.js";
const isCms = (value) => typeof value === "object" &&
    value !== null &&
    typeof value.migrate === "function" &&
    typeof value.close === "function";
/**
 * Loads the config file (a path relative to `cwd`) and returns the CMS instance it exports (`export const cms = defineConfig({ ... })`, or as the default
 * export). TypeScript files are read by tsx, which the command (`bin/monti.mjs`) registers first. The environment must already hold the values the file reads.
 */
export async function importCms(cwd, configPath) {
    const configModule = (await import(pathToFileURL(path.resolve(cwd, configPath)).href));
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
export async function loadApp(options) {
    const log = options.log ?? console.log;
    const loaded = loadEnvFiles(options.cwd, options.envFiles);
    if (loaded.length > 0)
        log(`env: ${loaded.join(", ")}`);
    const configPath = resolveConfigPath(options.cwd, options.config);
    log(`config: ${configPath}`);
    return importCms(options.cwd, configPath);
}
