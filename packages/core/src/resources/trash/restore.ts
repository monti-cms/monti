import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { lockFolderScope } from "../../db/locks";
import type { WriteContext } from "../../engine/types";
import { firstFree } from "../_shared/names";
import { freeSlug } from "../entries/duplicate";
import { tablesOf } from "../entries/tables";
import { activeChildren } from "../folders/folders";
import type { idInput } from "./input";
import { findTarget, type TrashRef, type TrashTarget } from "./items";
import { anyOf, itemsOf } from "./tree";

/**
 * `folderId` 폴더에 있던 항목이 돌아갈 활성 폴더: 그 폴더가 활성이면 그 폴더, 아니면 같은 위치의 같은 `scope`·이름의
 * 활성 폴더이고, 없으면 새로 만든다. 휴지통의 폴더는 휴지통에 그대로 둔다.
 */
async function activeFolder(ctx: WriteContext, folderId: string | null): Promise<string | null> {
	if (folderId === null) return null;
	const folder = await ctx.db.selectFrom("folders").selectAll().where("id", "=", folderId).executeTakeFirstOrThrow();
	if (folder.trashed_at === null) return folderId;
	const parent_id = await activeFolder(ctx, folder.parent_id);
	const twin = await activeChildren(ctx, folder.scope, parent_id).where("name", "=", folder.name).executeTakeFirst();
	if (twin !== undefined) return twin.id;
	const id = randomUUID();
	await ctx.db.insertInto("folders").values({ id, scope: folder.scope, parent_id, name: folder.name }).execute();
	return id;
}

/** 글(`table`은 그 컬렉션)이나 미디어(`table`은 `"media"`)를 휴지통에서 꺼내 활성 폴더에 넣는다. */
async function untrash(ctx: WriteContext, table: string, id: string): Promise<void> {
	const row = await tablesOf(ctx.db)
		.selectFrom(table)
		.select("folder_id")
		.where("id", "=", id)
		.executeTakeFirstOrThrow();
	const folder_id = await activeFolder(ctx, row.folder_id as string | null);
	await tablesOf(ctx.db).updateTable(table).set({ trashed_at: null, folder_id }).where("id", "=", id).execute();
}

/** 글의 각 언어 작업본 `slug`가 같은 컬렉션·언어의 활성 글 작업본과 겹치면 `-2`, `-3`…을 붙인다. */
async function freeSlugs(ctx: WriteContext, name: string, id: string): Promise<void> {
	const copies = await tablesOf(ctx.db)
		.selectFrom(`${name}_data`)
		.select(["locale", "slug"])
		.where("entry_id", "=", id)
		.where("status", "=", "draft")
		.where("slug", "is not", null)
		.execute();
	for (const { locale, slug } of copies) {
		await tablesOf(ctx.db)
			.updateTable(`${name}_data`)
			.set({ slug: await freeSlug(ctx, name, String(locale), String(slug)) })
			.where("entry_id", "=", id)
			.where("locale", "=", locale)
			.where("status", "=", "draft")
			.execute();
	}
}

/** 컬렉션 `name`의 글을 초안으로 되살린다: 모든 언어의 발행본을 지우고 작업본만 남긴다. */
async function restoreEntry(ctx: WriteContext, name: string, id: string): Promise<void> {
	await freeSlugs(ctx, name, id);
	await tablesOf(ctx.db)
		.deleteFrom(`${name}_data`)
		.where("entry_id", "=", id)
		.where("status", "=", "published")
		.execute();
	await untrash(ctx, name, id);
}

/** 폴더를 활성 부모 아래로 되돌린다. 거기 활성 폴더가 같은 이름을 쓰면 번호를 붙인다. */
async function placeFolder(ctx: WriteContext, id: string): Promise<void> {
	const folder = await ctx.db.selectFrom("folders").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
	const parent_id = await activeFolder(ctx, folder.parent_id);
	const siblings = await activeChildren(ctx, folder.scope, parent_id).execute();
	const name = firstFree(folder.name, new Set(siblings.map((sibling) => sibling.name)));
	await ctx.db.updateTable("folders").set({ parent_id, name }).where("id", "=", id).execute();
}

/** 폴더를 함께 들어갔던 항목과 함께 되살린다. 먼저 따로 버린 항목은 휴지통에 남는다. */
async function restoreFolder(ctx: WriteContext, target: TrashTarget): Promise<void> {
	const tree = await itemsOf(ctx, target);
	await placeFolder(ctx, target.id);
	await ctx.db.updateTable("folders").set({ trashed_at: null }).where("id", "=", anyOf(tree.folders)).execute();
	await ctx.db.updateTable("media").set({ trashed_at: null }).where("id", "=", anyOf(tree.media)).execute();
	for (const entryId of tree.entries) await restoreEntry(ctx, tree.scope, entryId);
}

async function restoreTarget(ctx: WriteContext, target: TrashTarget): Promise<void> {
	if (target.kind === "folder") return restoreFolder(ctx, target);
	if (target.kind === "entry") return restoreEntry(ctx, target.scope, target.id);
	return untrash(ctx, "media", target.id);
}

/**
 * 휴지통 항목을 휴지통에서 꺼낸다. 그 `scope`의 폴더 구조 잠금을 잡은 뒤에 폴더 이름을 고르고 새 폴더를 만들어, 겹친
 * 되살리기·폴더 만들기·고치기가 커밋된 뒤의 이름을 보고 다시 쓰거나 번호를 붙인다.
 */
export async function restoreItem(input: z.infer<typeof idInput>, ctx: WriteContext): Promise<TrashRef> {
	const { scope } = await findTarget(ctx, input.id);
	await lockFolderScope(ctx.db, scope);
	// 잠금을 기다리는 동안 겹친 되살리기나 영구 삭제가 이 항목을 휴지통에서 뺐을 수 있다: 그러면 `NOT_FOUND`다.
	const target = await findTarget(ctx, input.id);
	await restoreTarget(ctx, target);
	return { kind: target.kind, id: target.id };
}
