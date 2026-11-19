import { z } from "zod";
import { defineRead, defineWrite } from "../../engine/operation";
import type { ReadContext, Schema, WriteContext } from "../../engine/types";

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

const schemaInput: z.ZodType<Schema> = z.object({
	locales: z.array(z.string()),
	collections: z.record(z.string(), collection),
});

async function getSchema(_input: unknown, ctx: ReadContext): Promise<Schema> {
	return ctx.schema;
}

async function updateSchema(input: Schema, ctx: WriteContext): Promise<Schema> {
	ctx.setSchema(input);
	return input;
}

/** The `schema` resource: `update` changes the schema on a dev server only. */
export const schema = {
	get: defineRead({ input: z.object({}), run: getSchema }),
	update: defineWrite({ input: schemaInput, run: updateSchema }),
};
