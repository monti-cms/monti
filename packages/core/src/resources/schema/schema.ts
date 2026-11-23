import { z } from "zod";
import { defineRead, defineWrite } from "../../engine/operation";
import { schemaShape } from "../../engine/schema-file";
import type { ReadContext, Schema, WriteContext } from "../../engine/types";
import { removeRelsPaths } from "./rels-paths";
import { syncSchemaTables } from "./sync-tables";

/** 스키마의 사본: 받은 쪽이 고쳐도 엔진의 스키마는 그대로다. */
async function getSchema(_input: unknown, ctx: ReadContext): Promise<Schema> {
	return structuredClone(ctx.schema);
}

/**
 * 개발 서버인지 먼저 확인하고, 같은 트랜잭션 안에서 지운 다건 참조 필드의 연결 행·미디어 사용처를 지우고 컬렉션 테이블을
 * 새 스키마에 맞춘다.
 */
async function updateSchema(input: Schema, ctx: WriteContext): Promise<Schema> {
	const previous = ctx.schema;
	await ctx.setSchema(input);
	await removeRelsPaths(ctx, previous, input);
	await syncSchemaTables(ctx.db, input);
	return input;
}

/** `schema` 리소스: `update`는 개발 서버에서만 스키마를 바꾼다. */
export const schema = {
	get: defineRead({ input: z.object({}), run: getSchema }),
	update: defineWrite({ input: schemaShape, run: updateSchema }),
};
