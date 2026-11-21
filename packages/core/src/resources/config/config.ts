import { z } from "zod";
import { defineRead, defineWrite } from "../../engine/operation";
import type { MontiConfig, ReadContext, WriteContext } from "../../engine/types";

const nameInput = z.object({ name: z.string().min(1) });

async function getConfig(_input: unknown, ctx: ReadContext): Promise<MontiConfig> {
	return ctx.config;
}

async function updateConfig(input: z.infer<typeof nameInput>, ctx: WriteContext): Promise<{ name: string }> {
	ctx.setConfig(input);
	return input;
}

/** `config` 리소스: `update`는 개발 서버에서만 사이트 이름을 바꾼다. */
export const config = {
	get: defineRead({ input: z.object({}), run: getConfig }),
	update: defineWrite({ input: nameInput, run: updateConfig }),
};
