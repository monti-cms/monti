import { writeFile } from "node:fs/promises";
import { z } from "zod";
import type { Schema } from "./types";

const fieldMeta = {
	required: z.boolean().optional(),
	label: z.string().optional(),
	description: z.string().optional(),
};

const many = z.boolean().optional();

const valueField = z.discriminatedUnion("type", [
	z.object({ ...fieldMeta, type: z.literal("text"), max: z.number().optional() }),
	z.object({ ...fieldMeta, type: z.literal("number") }),
	z.object({ ...fieldMeta, type: z.literal("boolean") }),
	z.object({ ...fieldMeta, type: z.literal("date") }),
	z.object({ ...fieldMeta, type: z.literal("select"), options: z.array(z.string()), many }),
	z.object({ ...fieldMeta, type: z.literal("media"), many }),
	z.object({ ...fieldMeta, type: z.literal("relation"), to: z.string(), many }),
]);

const conditionalField = z.object({
	...fieldMeta,
	type: z.literal("conditional"),
	options: z.record(z.string(), z.object({ fields: z.record(z.string(), valueField) })),
});

const collection = z.object({
	body: z.boolean().optional(),
	label: z.string().optional(),
	description: z.string().optional(),
	fields: z.record(z.string(), z.discriminatedUnion("type", [...valueField.options, conditionalField])),
});

/** The shape a user schema must have: its fields are of the 8 defined types. */
export const schemaShape: z.ZodType<Schema> = z.object({
	locales: z.array(z.string()),
	collections: z.record(z.string(), collection),
});

/** Writes the schema to `monti.schema.ts` as the module's default export. */
export async function writeSchemaFile(file: string, schema: Schema): Promise<void> {
	await writeFile(file, `export default ${JSON.stringify(schema, null, "\t")};\n`);
}
