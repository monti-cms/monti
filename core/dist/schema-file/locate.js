import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { problemError } from "../core/problem.js";
import { parseSchemaFile } from "./format.js";
/** Where a site keeps its schema file, in the order `monti` looks for it. */
export const SCHEMA_FILE_CANDIDATES = ["monti.schema.ts", "src/monti.schema.ts"];
/** The schema file of a site: the chosen path, or the first default location that exists. Throws if there is none. */
export function findSchemaFile(cwd, chosen) {
    const found = chosen ?? SCHEMA_FILE_CANDIDATES.find((candidate) => existsSync(path.join(cwd, candidate)));
    if (!found || !existsSync(path.resolve(cwd, found))) {
        throw problemError(found
            ? {
                what: `The schema file ${found} does not exist`,
                where: "the --schema option",
                fix: `correct the path (it is relative to ${cwd}) or leave the option out so \`monti\` looks for ${SCHEMA_FILE_CANDIDATES.join(" or ")}`,
            }
            : {
                what: `Cannot find ${SCHEMA_FILE_CANDIDATES[0]} (looked in ${cwd}, also under src/)`,
                where: "the folder you ran `monti` in",
                fix: "run `monti` from the folder of your app, or pass --schema <path>; `monti init` creates a schema file, and `monti schema:extract` makes one from collections written in code",
            }, undefined, "schema_missing");
    }
    return found;
}
/** Makes each fresh import address its own (two within a millisecond). */
let loads = 0;
/**
 * Imports a schema file (TypeScript is read by tsx, which `bin/monti.mjs` registers) and checks what it exports. `fresh` adds a cache-buster to the address, so a file
 * that changed since it was last imported in this process is evaluated again. Errors name the file and the path of each problem.
 */
export async function loadSchemaFile(cwd, schema, options = {}) {
    const file = path.resolve(cwd, schema);
    const href = pathToFileURL(file).href;
    let loaded;
    try {
        loaded = await import(options.fresh ? `${href}?fresh=${Date.now()}-${++loads}` : href);
    }
    catch (error) {
        throw problemError({
            what: `${schema} cannot be loaded: ${error instanceof Error ? error.message : String(error)}`,
            where: schema,
            fix: "correct the file (a syntax error, or an import that does not resolve); an editor with TypeScript support underlines it",
        }, error, "schema_invalid");
    }
    if (loaded.default === undefined) {
        throw problemError({
            what: `${schema} has no default export`,
            where: schema,
            fix: "write `export default defineSchema({ ... })` with `defineSchema` from `@monti-cms/core`",
        }, undefined, "schema_invalid");
    }
    return parseSchemaFile(loaded.default, schema);
}
