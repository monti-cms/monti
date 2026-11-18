import { z } from "zod";
import { defineRead, defineWrite } from "../../engine/operation";
import type { MontiConfig, ReadContext, WriteContext } from "../../engine/types";

const nameInput = z.object({ name: z.string() });

async function getConfig(_input: unknown, ctx: ReadContext): Promise<MontiConfig> {
	return ctx.config;
}

async function updateConfig(input: z.infer<typeof nameInput>, ctx: WriteContext): Promise<{ name: string }> {
	ctx.setConfig(input);
	return input;
}

/** The `config` resource: `update` renames the site on a dev server only. */
export const config = {
	get: defineRead({ input: z.object({}), run: getConfig }),
	update: defineWrite({ input: nameInput, run: updateConfig }),
};
