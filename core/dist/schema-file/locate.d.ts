import type { SchemaFile } from "./types.js";
/** Where a site keeps its schema file, in the order `monti` looks for it. */
export declare const SCHEMA_FILE_CANDIDATES: readonly ["monti.schema.ts", "src/monti.schema.ts"];
/** The schema file of a site: the chosen path, or the first default location that exists. Throws if there is none. */
export declare function findSchemaFile(cwd: string, chosen?: string): string;
/**
 * Imports a schema file (TypeScript is read by tsx, which `bin/monti.mjs` registers) and checks what it exports. `fresh` adds a cache-buster to the address, so a file
 * that changed since it was last imported in this process is evaluated again. Errors name the file and the path of each problem.
 */
export declare function loadSchemaFile(cwd: string, schema: string, options?: {
    readonly fresh?: boolean;
}): Promise<SchemaFile>;
