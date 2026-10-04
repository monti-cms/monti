import path from "node:path";
import { pathToFileURL } from "node:url";
/**
 * Node module resolution hook (registered by `register.ts` and `monti migrate`). Only the config aliases are redirected to the app's files; everything else passes through.
 * File paths come from the value passed at registration (`initialize`); otherwise `CMS_CONFIG_PATH` and `CMS_SERVER_PATH` (default `./cms.config.ts` and
 * `./cms.server.ts`, relative to the current directory).
 */
let aliases = {
    "@cms-config": process.env.CMS_CONFIG_PATH ?? "./cms.config.ts",
    "@cms-server": process.env.CMS_SERVER_PATH ?? "./cms.server.ts",
};
/** Alias files passed at registration (`register(url, { data: { aliases } })`). */
export const initialize = (data) => {
    if (data?.aliases)
        aliases = { ...aliases, ...data.aliases };
};
export const resolve = (specifier, context, next) => {
    const file = aliases[specifier];
    return file ? next(pathToFileURL(path.resolve(process.cwd(), file)).href, context) : next(specifier, context);
};
