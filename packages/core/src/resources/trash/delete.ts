import { sql } from "kysely";
import type { z } from "zod";
import type { WriteContext } from "../../engine/types";
import { tablesOf } from "../entries/tables";
import { lockStorageKey, queueLooseFilesNow } from "../media/queries";
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

/**
 * 휴지통에 있는 미디어 `ids`의 저장소 키를 정렬된 순서로 잠가 같은 키의 등록·교체·정리와 겹치지 않게 한다. 한 번의 삭제가
 * 지울 모든 키를 한꺼번에 잠가, 대상을 다른 순서로 준 동시 삭제끼리도 서로 기다리다 멈추지 않는다.
 */
async function lockTrashedMediaKeys(ctx: WriteContext, ids: string[]): Promise<void> {
	if (ids.length === 0) return;
	const rows = await ctx.db
		.selectFrom("media")
		.select("key")
		.distinct()
		.where("id", "=", anyOf(ids))
		.where("trashed_at", "is not", null)
		.orderBy("key", "asc")
		.execute();
	for (const { key } of rows) await lockStorageKey(ctx.db, key);
}

/**
 * 휴지통에 있는 미디어 `ids`의 행을 `id` 순서로 잠근다. 사용처를 기록하는 쓰기도 미디어 행을 `id` 순서로 잠그므로, 여러
 * 미디어를 겹쳐 지우고 참조하는 쓰기끼리 서로 기다리다 멈추지 않는다.
 */
async function lockTrashedMediaRows(ctx: WriteContext, ids: string[]): Promise<void> {
	if (ids.length === 0) return;
	await ctx.db
		.selectFrom("media")
		.select("id")
		.where("id", "=", anyOf(ids))
		.where("trashed_at", "is not", null)
		.orderBy("id")
		.forUpdate()
		.execute();
}

/**
 * 휴지통의 미디어들을 지운다. 사용처 기록과 글의 참조는 DB 외래 키가 정리하고, 파일은 지금 지울 임시 파일로 `loose_files`에
 * 올린다. 키와 행은 `deleteItems`가 먼저 잠근다.
 */
async function deleteMedia(ctx: WriteContext, ids: string[]): Promise<void> {
	if (ids.length === 0) return;
	const deleted = await ctx.db
		.deleteFrom("media")
		.where("id", "=", anyOf(ids))
		.where("trashed_at", "is not", null)
		.returning("key")
		.execute();
	await queueLooseFilesNow(
		ctx,
		deleted.map((row) => row.key),
	);
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
	const trees: Tree[] = [];
	for (const target of targets) trees.push(await itemsOf(ctx, target));
	const media = trees.flatMap((tree) => tree.media);
	await lockTrashedMediaKeys(ctx, media);
	await lockTrashedMediaRows(ctx, media);
	for (const tree of trees) await deleteTree(ctx, tree);
	const refs = targets.map(({ kind, id }) => ({ kind, id }));
	return "id" in input ? refs[0] : refs;
}
