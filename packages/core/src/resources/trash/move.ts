import { sql } from "kysely";
import type { z } from "zod";
import type { WriteContext } from "../../engine/types";
import { tablesOf } from "../entries/tables";
import type { idInput } from "./input";
import { findActive, type TrashRef } from "./items";
import { anyOf, entryTable, itemsOf } from "./tree";

/** DB 시계를 한 번 읽은 값. 마이크로초가 사라지지 않도록 텍스트로 받는다. */
async function clock(ctx: WriteContext): Promise<string> {
	const { rows } = await sql<{ now: string }>`select clock_timestamp()::text as now`.execute(ctx.db);
	return rows[0].now;
}

/**
 * 활성 글·폴더·미디어를 휴지통에 보낸다. 폴더는 그 아래의 활성 하위 폴더·글·미디어를 같은 시각으로 함께 보낸다. 다른
 * 글의 참조 값과 미디어 사용처 기록은 되살릴 때를 위해 그대로 둔다.
 */
export async function moveItem(input: z.infer<typeof idInput>, ctx: WriteContext): Promise<TrashRef> {
	const { kind, id, scope } = await findActive(ctx, input.id);
	const tree = await itemsOf(ctx, { kind, id, scope });
	const trashed_at = await clock(ctx);
	const table = entryTable(ctx, tree.scope);
	if (table !== undefined) {
		await tablesOf(ctx.db).updateTable(table).set({ trashed_at }).where("id", "=", anyOf(tree.entries)).execute();
	}
	await ctx.db.updateTable("media").set({ trashed_at }).where("id", "=", anyOf(tree.media)).execute();
	await ctx.db.updateTable("folders").set({ trashed_at }).where("id", "=", anyOf(tree.folders)).execute();
	return { kind, id };
}
