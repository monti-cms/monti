/**
 * The JSON Schema of the schema file, for editor autocomplete and validation (`"$schema": "./node_modules/@monti-cms/core/schema.json"`).
 * It is generated from the same definition the runtime check uses (`format.ts`) and written to the package's `schema.json` by `pnpm --filter @monti-cms/core schema:build`;
 * a test fails when the committed file is out of date.
 *
 * The JSON Schema describes the shape. The runtime check also applies rules a JSON Schema cannot say (a default option that exists, a relation to a collection
 * that exists), so an editor accepting a file does not mean `defineSite` will.
 */
export declare function buildJsonSchema(): Record<string, unknown>;
/** The text of `schema.json`. */
export declare const jsonSchemaText: () => string;
