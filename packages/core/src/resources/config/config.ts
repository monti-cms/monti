import { z } from "zod";
import { defineRead, defineWrite } from "../../engine/operation";
import type { MontiConfig, ReadContext, WriteContext } from "../../engine/types";

const nameInput = z.object({ name: z.string().min(1) });

/** 설정의 사본: 받은 쪽이 고쳐도 엔진의 설정은 그대로다. 저장소·플러그인은 함수를 가진 객체라 그대로 가리킨다. */
async function getConfig(_input: unknown, ctx: ReadContext): Promise<MontiConfig> {
	return { ...ctx.config };
}

async function updateConfig(input: z.infer<typeof nameInput>, ctx: WriteContext): Promise<{ name: string }> {
	await ctx.setConfig(input);
	return input;
}

/** `config` 리소스: `update`는 개발 서버에서만 사이트 이름을 바꾼다. */
export const config = {
	get: defineRead({ input: z.object({}), run: getConfig }),
	update: defineWrite({ emit: true, input: nameInput, run: updateConfig }),
};
