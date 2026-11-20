import { z } from "zod";
import { defineRead, defineWrite } from "../../engine/operation";
import { schemaShape } from "../../engine/schema-file";
import type { ReadContext, Schema, WriteContext } from "../../engine/types";

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
	update: defineWrite({ input: schemaShape, run: updateSchema }),
};
