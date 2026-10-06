/**
 * Outside Next (custom command-line scripts), links `@cms-config`, which CMS code reads, to the app's site config file.
 * The CMS instance needs no link: the script imports it from the app's server file (`import { cms } from "./cms.server"`).
 *
 * ```sh
 * tsx --env-file=.env.local --import @monti-cms/core/register my-script.ts
 * ```
 *
 * The site config file path is `CMS_CONFIG_PATH` (default `./cms.config.ts`, relative to the current directory).
 */
import { register } from "node:module";

register(new URL(import.meta.url.endsWith(".ts") ? "./register-hooks.ts" : "./register-hooks.js", import.meta.url));
