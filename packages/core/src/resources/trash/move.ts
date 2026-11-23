import { sql } from "kysely";
import type { z } from "zod";
import { lockFolderScope } from "../../db/locks";
import { MontiError } from "../../engine/errors";
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
 * `table`의 `ids` 가운데 아직 활성인 행만 `trashed_at` 시각으로 휴지통에 보내고 바뀐 행 수를 돌려준다. 먼저 따로 버린 행의
 * 시각은 그대로 둔다.
 */
async function trashRows(ctx: WriteContext, table: string, ids: string[], trashed_at: string): Promise<bigint> {
	const result = await tablesOf(ctx.db)
		.updateTable(table)
		.set({ trashed_at })
		.where("id", "=", anyOf(ids))
		.where("trashed_at", "is", null)
		.executeTakeFirst();
	return result.numUpdatedRows;
}

/**
 * 활성 글·폴더·미디어를 휴지통에 보낸다. 폴더는 그 아래의 활성 하위 폴더·글·미디어를 같은 시각으로 함께 보낸다. 다른
 * 글의 참조 값과 미디어 사용처 기록은 되살릴 때를 위해 그대로 둔다. 폴더는 그 `scope`의 잠금을 잡은 뒤 다시 찾고 함께 보낼
 * 항목을 모아, 겹친 폴더 이동·폴더에 넣는 쓰기가 커밋된 뒤의 트리를 본다. 글·미디어 하나는 폴더 구조를 바꾸지 않아 잠그지
 * 않고, 겹친 상위 폴더의 이동이 먼저 함께 보냈으면 바뀐 행이 없어 거절한다.
 */
export async function moveItem(input: z.infer<typeof idInput>, ctx: WriteContext): Promise<TrashRef> {
	const found = await findActive(ctx, input.id);
	if (found.kind === "folder") await lockFolderScope(ctx.db, found.scope);
	// 잠금을 기다리는 동안 겹친 상위 폴더의 휴지통 이동이 이 폴더를 함께 보냈을 수 있다: 그러면 `NOT_FOUND`다.
	const { kind, id, scope } = found.kind === "folder" ? await findActive(ctx, input.id) : found;
	const tree = await itemsOf(ctx, { kind, id, scope });
	const trashed_at = await clock(ctx);
	const table = entryTable(ctx, tree.scope);
	const entries = table === undefined ? 0n : await trashRows(ctx, table, tree.entries, trashed_at);
	const media = await trashRows(ctx, "media", tree.media, trashed_at);
	const folders = await trashRows(ctx, "folders", tree.folders, trashed_at);
	if (entries + media + folders === 0n) throw new MontiError("NOT_FOUND", "이 id의 활성 글·폴더·미디어가 없다");
	return { kind, id };
}
