import { existsSync } from "node:fs";
import path from "node:path";
import { problemError } from "../core/problem.js";
import { findSchemaFile, SCHEMA_FILE_CANDIDATES } from "../schema-file/locate.js";
function locate(lookup) {
    const { cwd, chosen, candidates } = lookup;
    const fromEnv = lookup.fromEnv?.value || undefined;
    const found = chosen ?? fromEnv ?? candidates.find((candidate) => existsSync(path.join(cwd, candidate)));
    if (found && existsSync(path.resolve(cwd, found)))
        return found;
    throw problemError(found
        ? {
            what: `The ${lookup.label} ${found} does not exist`,
            where: chosen ? `the ${lookup.option} option` : `the ${lookup.fromEnv?.name} environment variable`,
            fix: `correct the path (it is relative to ${cwd}), or remove the option so \`monti\` looks for ${candidates.join(" or ")}`,
        }
        : {
            what: `Cannot find ${candidates[0]} (looked in ${cwd}, also under src/)`,
            where: "the folder you ran `monti` in",
            fix: lookup.notFoundFix,
        }, undefined, lookup.kind);
}
/** Candidate locations of the config file, the module that exports the CMS instance as `cms`. */
export const CONFIG_CANDIDATES = ["monti.config.ts", "src/monti.config.ts"];
/**
 * Location of the config file (`monti.config.ts`, the module that exports the CMS instance as `cms`). Looked up in this order: the chosen value
 * (`--config`) -> the `MONTI_CONFIG_PATH` environment variable -> common locations (`./monti.config.ts`, `./src/monti.config.ts`).
 */
export function locateConfig(cwd, chosen = undefined, env = process.env) {
    return locate({
        cwd,
        chosen,
        fromEnv: { name: "MONTI_CONFIG_PATH", value: env.MONTI_CONFIG_PATH },
        candidates: CONFIG_CANDIDATES,
        option: "--config",
        label: "config file",
        notFoundFix: "run `monti` from the folder of your Next app, or point at the file with --config <path> or MONTI_CONFIG_PATH; `monti init` creates one in an app that has none",
        kind: "config_missing",
    });
}
/**
 * Where a site keeps the config `monti schema:extract` reads, in the order it looks: `monti.config.ts` (a config whose data is still written in code), then the
 * site config file of the earlier setup (`cms.config.ts`, a default export of `defineSite` from `@monti-cms/core`).
 */
export const EXTRACT_CONFIG_CANDIDATES = [
    "monti.config.ts",
    "src/monti.config.ts",
    "cms.config.ts",
    "src/cms.config.ts",
];
/** The config file `monti schema:extract` reads: the chosen path (`--config`), else the first of {@link EXTRACT_CONFIG_CANDIDATES}. */
export function locateExtractConfig(cwd, chosen) {
    return locate({
        cwd,
        chosen,
        candidates: EXTRACT_CONFIG_CANDIDATES,
        option: "--config",
        label: "config file",
        notFoundFix: "run `monti` from the folder of your app, or pass --config <path>",
        kind: "config_missing",
    });
}
/** The schema file of a site: the chosen path (`--schema`), else the first of {@link SCHEMA_FILE_CANDIDATES}. The lookup itself lives with the schema file format. */
export const locateSchema = findSchemaFile;
export { SCHEMA_FILE_CANDIDATES };
