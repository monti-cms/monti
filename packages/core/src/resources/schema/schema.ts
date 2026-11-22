import { z } from "zod";
import { defineRead, defineWrite } from "../../engine/operation";
import { schemaShape } from "../../engine/schema-file";
import type { ReadContext, Schema, WriteContext } from "../../engine/types";
import { syncSchemaTables } from "./sync-tables";

async function getSchema(_input: unknown, ctx: ReadContext): Promise<Schema> {
	return ctx.schema;
}

/** 개발 서버인지 먼저 확인하고, 같은 트랜잭션 안에서 컬렉션 테이블을 새 스키마에 맞춘다. */
async function updateSchema(input: Schema, ctx: WriteContext): Promise<Schema> {
	ctx.setSchema(input);
	await syncSchemaTables(ctx.db, input);
	return input;
}

/** `schema` 리소스: `update`는 개발 서버에서만 스키마를 바꾼다. */
export const schema = {
	get: defineRead({ input: z.object({}), run: getSchema }),
	update: defineWrite({ input: schemaShape, run: updateSchema }),
};
