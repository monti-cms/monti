import { writeFileSync } from "node:fs";
import { jsonSchemaText } from "../src/schema-file/json-schema";

/** Writes the package's `schema.json` (the JSON Schema of the schema file). Run by `pnpm --filter @monti-cms/core schema:build`. */
const target = new URL("../schema.json", import.meta.url);
writeFileSync(target, jsonSchemaText());
console.log(`wrote ${target.pathname}`);
