import { sql } from "kysely";
import type { z } from "zod";
import type { WriteContext } from "../../engine/types";
import { tablesOf } from "../entries/tables";
import type { deleteInput } from "./input";
import { findTarget, listedTargets, type TrashRef, type TrashTarget } from "./items";
import { anyOf, entryTable, itemsOf, type Tree } from "./tree";

type DeleteInput = z.infer<typeof deleteInput>;

/**
 * 컬렉션 `table`의 글들을 지운다. 모든 언어의 데이터·다건 참조 행과 다른 글의 참조는 DB 외래 키가 정리하고, 외래 키가
 * 없는 미디어 사용처 기록은 여기서 지운다.
 */
async function deleteEntries(ctx: WriteContext, table: string, ids: string[]): Promise<void> {
	await ctx.db
		.deleteFrom("media_uses")
		.where("source_kind", "=", "entry")
		.where("source_id", "=", anyOf(ids))
		.execute();
	await tablesOf(ctx.db).deleteFrom(table).where("id", "=", anyOf(ids)).execute();
}

/** 미디어들을 지운다. 사용처 기록과 글의 참조는 DB 외래 키가 정리하고, 파일은 `loose_files`에 올린다. */
async function deleteMedia(ctx: WriteContext, ids: string[]): Promise<void> {
	await ctx.db
		.insertInto("loose_files")
		.columns(["key", "remove_after"])
		.expression((eb) =>
			eb
				.selectFrom("media")
				.select(["key", sql<Date>`now()`.as("remove_after")])
				.where("id", "=", anyOf(ids)),
		)
		.execute();
	await ctx.db.deleteFrom("media").where("id", "=", anyOf(ids)).execute();
}

/** 폴더들을 지운다. 그 안에 남은 먼저 따로 버린 항목은 루트로 옮겨 휴지통에 둔다. */
async function deleteFolders(ctx: WriteContext, ids: string[], table: string | undefined): Promise<void> {
	if (table !== undefined) {
		await tablesOf(ctx.db).updateTable(table).set({ folder_id: null }).where("folder_id", "=", anyOf(ids)).execute();
	}
	await ctx.db.updateTable("media").set({ folder_id: null }).where("folder_id", "=", anyOf(ids)).execute();
	await ctx.db.updateTable("folders").set({ parent_id: null }).where("parent_id", "=", anyOf(ids)).execute();
	await ctx.db.deleteFrom("folders").where("id", "=", anyOf(ids)).execute();
}

async function deleteTree(ctx: WriteContext, tree: Tree): Promise<void> {
	const table = entryTable(ctx, tree.scope);
	if (table !== undefined) await deleteEntries(ctx, table, tree.entries);
	await deleteMedia(ctx, tree.media);
	await deleteFolders(ctx, tree.folders, table);
}

/** `ids`의 휴지통 항목들. 하나라도 휴지통 항목이 아니면 모두 거절한다. */
async function namedTargets(ctx: WriteContext, ids: string[]): Promise<TrashTarget[]> {
	const targets: TrashTarget[] = [];
	for (const id of new Set(ids)) targets.push(await findTarget(ctx, id));
	return targets;
}

/** 입력이 가리키는 항목들: `id`로 준 것, `before`보다 먼저 버린 자기 줄이 있는 것, 또는 자기 줄이 있는 모든 것. */
async function targetsOf(ctx: WriteContext, input: DeleteInput): Promise<TrashTarget[]> {
	if ("id" in input) return namedTargets(ctx, [input.id]);
	if ("ids" in input) return namedTargets(ctx, input.ids);
	let query = listedTargets(ctx);
	// 시각은 텍스트로 둔다: JS `Date`로 바꾸면 DB가 비교하기 전에 마이크로초가 잘린다.
	if ("before" in input) query = query.where(sql<boolean>`item.trashed_at < ${input.before}::timestamptz`);
	return query.execute();
}

/** 휴지통 항목을 함께 들어간 것과 함께 영구 삭제한다. */
export async function deleteItems(input: DeleteInput, ctx: WriteContext): Promise<TrashRef | TrashRef[]> {
	const targets = await targetsOf(ctx, input);
	for (const target of targets) await deleteTree(ctx, await itemsOf(ctx, target));
	const refs = targets.map(({ kind, id }) => ({ kind, id }));
	return "id" in input ? refs[0] : refs;
}
