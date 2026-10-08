import type { SchemaFile } from "./types.js";
/** What `defineSite` takes next to `schema`: the code part of the config (anything the config has, except what the file owns). */
type CodeConfig = {
    readonly schema: unknown;
} & {
    readonly [key: string]: unknown;
};
/** Reads the schema of a config's `schema` option: the parsed JSON, or the path of the file (relative to the working directory). */
export declare function loadSchemaOption(schema: unknown): SchemaFile;
/**
 * Merges the schema file into the code part of a config, and returns the config `defineSite` checks like any other. The rule is that code adds to the file
 * and may override its environment-specific settings, but never silently replaces its data:
 *
 * - `collections`: the file's collections and the code's, side by side. The same name in both is an error.
 * - `locales`, `defaultLocale` and `schemaVersion`: only in the file (setting them in code too is an error).
 * - `site` and `admin`: key by key, the code's value wins. A key set to `undefined` in code leaves the file's value.
 * - `timeZone`: the code's value wins.
 * - `seed.templates`: the file's templates, then the code's.
 * - everything else (`plugins`, `blocks`, `codeBlock`, `media`): from code, the file has none of it.
 */
export declare function resolveSchemaConfig(config: CodeConfig): Record<string, unknown>;
export {};
