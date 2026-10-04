import { register } from "node:module";
import path from "node:path";
import { CONFIG_ALIAS, resolveConfigPaths, SERVER_ALIAS } from "./config-paths.js";
import { loadEnvFiles } from "./env.js";
/**
 * `monti migrate`: reads env files, points the config aliases (`@cms-config`, `@cms-server`) at the app's files, then creates the tables in the store.
 * TypeScript config files are read by tsx, which the command (`bin/monti.mjs`) registers first. Returns `true` on success.
 */
export async function migrate(options) {
    const log = options.log ?? console.log;
    const loaded = loadEnvFiles(options.cwd, options.envFiles);
    if (loaded.length > 0)
        log(`env: ${loaded.join(", ")}`);
    const paths = resolveConfigPaths(options.cwd, { config: options.config, server: options.server });
    log(`config: ${paths.config} · server: ${paths.server}`);
    const hooks = new URL(import.meta.url.endsWith(".ts") ? "../register-hooks.ts" : "../register-hooks.js", import.meta.url);
    register(hooks, {
        data: {
            aliases: {
                [CONFIG_ALIAS]: path.resolve(options.cwd, paths.config),
                [SERVER_ALIAS]: path.resolve(options.cwd, paths.server),
            },
        },
    });
    const { runMigrate } = await import("../adapters/postgres/run-migrate.js");
    return runMigrate(log);
}
