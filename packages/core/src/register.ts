/**
 * Outside Next (custom command-line scripts), links `@cms-config` and `@cms-server`, which CMS code reads, to the app's config files.
 * Table creation is wired up by the `monti migrate` command itself.
 *
 * ```sh
 * tsx --env-file=.env.local --import @monti-cms/core/register my-script.ts
 * ```
 *
 * Config file paths are `CMS_CONFIG_PATH` and `CMS_SERVER_PATH` (default `./cms.config.ts` and `./cms.server.ts`, relative to the current directory).
 */
import { register } from "node:module";

register(new URL(import.meta.url.endsWith(".ts") ? "./register-hooks.ts" : "./register-hooks.js", import.meta.url));
