import { z } from "zod";
import { schemaFileShape } from "./format.js";
/**
 * The JSON Schema of the schema file, for editor autocomplete and validation (`"$schema": "./node_modules/@monti-cms/core/schema.json"`).
 * It is generated from the same definition the runtime check uses (`format.ts`) and written to the package's `schema.json` by `pnpm --filter @monti-cms/core schema:build`;
 * a test fails when the committed file is out of date.
 *
 * The JSON Schema describes the shape. The runtime check also applies rules a JSON Schema cannot say (a default option that exists, a relation to a collection
 * that exists), so an editor accepting a file does not mean `defineSite` will.
 */
export function buildJsonSchema() {
    const schema = z.toJSONSchema(schemaFileShape, { target: "draft-7", io: "input", unrepresentable: "any" });
    return {
        ...schema,
        title: "Monti schema file",
        description: "The plain-data part of a Monti site config: collections, fields, layouts, locales, time zone, site and admin settings and seed templates. Plugins, blocks and hooks stay in cms.config.ts.",
    };
}
/** The text of `schema.json`. */
export const jsonSchemaText = () => `${JSON.stringify(buildJsonSchema(), null, "\t")}\n`;
