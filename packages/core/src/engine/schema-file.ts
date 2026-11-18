import { writeFile } from "node:fs/promises";
import type { Schema } from "./types";

/** Writes the schema to `monti.schema.ts` as the module's default export. */
export async function writeSchemaFile(file: string, schema: Schema): Promise<void> {
	await writeFile(file, `export default ${JSON.stringify(schema, null, "\t")};\n`);
}
