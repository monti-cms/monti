import type { SchemaFile } from "../schema-file/types.js";
/** Where a site keeps its schema file, in the order `monti` looks for it. */
export declare const SCHEMA_FILE_CANDIDATES: readonly ["monti.schema.json", "src/monti.schema.json"];
/** Link to the JSON Schema the package ships, relative to a schema file at the site root. */
export declare const SCHEMA_LINK = "./node_modules/@monti-cms/core/schema.json";
/** Default name of the generated declaration file, next to the schema file. */
export declare const SCHEMA_TYPES_FILE = "monti-env.d.ts";
/** Prints a JSON value as a TypeScript literal type: every property `readonly`, every array a `readonly` tuple, every string its own literal type. */
export declare function toTypeLiteral(value: unknown, depth?: number): string;
/**
 * The declaration file for a schema: it registers the file's collections, locales and default locale in `MontiRegister`, so `defineSite({ schema })`,
 * `createCms`, `cms.read` and `DocumentComponentsFor` know the site's collection names, the shape of each collection's metadata, and the locale codes,
 * with nothing written by hand. It holds types only: nothing is imported at run time.
 */
export declare function schemaTypesText(file: SchemaFile, schemaName?: string): string;
export interface SchemaTypesOptions {
    readonly cwd: string;
    /** Schema file (relative to `cwd`). Default: `monti.schema.json`, then `src/monti.schema.json`. */
    readonly schema?: string;
    /** Declaration file to write (relative to `cwd`). Default: `monti-env.d.ts` next to the schema file. */
    readonly out?: string;
    /** Write nothing; report whether the declaration file is up to date. */
    readonly check?: boolean;
    readonly log?: (message: string) => void;
}
export interface SchemaTypesResult {
    /** Schema file, relative to `cwd`. */
    readonly schema: string;
    /** Declaration file, relative to `cwd`. */
    readonly out: string;
    /** Whether the declaration file was (or, with `check`, would be) changed. */
    readonly changed: boolean;
}
/** The schema file of a site: the chosen path, or the first default location that exists. Throws if there is none. */
export declare function findSchemaFile(cwd: string, chosen?: string): string;
/** Reads and checks a schema file. Errors name the file and the JSON path of each problem. */
export declare function readSchema(cwd: string, schema: string): SchemaFile;
/** `monti schema:types`: reads the schema file and writes the declaration file. With `check`, writes nothing and tells whether the file is out of date. */
export declare function generateSchemaTypes(options: SchemaTypesOptions): SchemaTypesResult;
/**
 * Writes the declaration file now and again every time the schema file changes, until the returned function is called. A schema that is half written or invalid
 * is reported through `log` and the last good declaration file stays. Used by `monti schema:types --watch` and by `withCms` in the dev server.
 */
export declare function watchSchemaTypes(options: SchemaTypesOptions & {
    readonly debounceMs?: number;
    /** Whether the watch keeps the process alive. Default true (the command); a dev server that only wants the types kept fresh passes false. */
    readonly persistent?: boolean;
}): () => void;
