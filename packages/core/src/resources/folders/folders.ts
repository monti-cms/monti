import { randomUUID } from "node:crypto";
import { z } from "zod";
import { lockFolderScope } from "../../db/locks";
import { MontiError } from "../../engine/errors";
import { defineRead, defineWrite } from "../../engine/operation";
import type { ReadContext, WriteContext } from "../../engine/types";
import { uuidInput } from "../_shared/input";

/** What the folder actions return of a folder. */
interface Folder {
	id: string;
	scope: string;
	name: string;
	parent_id: string | null;
}

const SHOWN = ["id", "scope", "name", "parent_id"] as const;

const listInput = z.object({ scope: z.string() });

async function listFolders(input: z.infer<typeof listInput>, ctx: ReadContext): Promise<Folder[]> {
	return ctx.db
		.selectFrom("folders")
		.select(SHOWN)
		.where("scope", "=", input.scope)
		.where("trashed_at", "is", null)
		.execute();
}

const createInput = z.object({
	__preset_id: uuidInput.optional(),
	scope: z.string(),
	name: z.string().min(1),
	parent_id: uuidInput.nullable().optional(),
});

/**
 * `"media"`나 스키마 컬렉션 범위에 폴더를 만든다. 부모를 주면 같은 범위의 활성 폴더여야 한다. 같은 위치의 활성 폴더와 이름이
 * 겹치면 DB 고유 색인이 `CONFLICT`로 막는다.
 */
async function createFolder(input: z.infer<typeof createInput>, ctx: WriteContext): Promise<Folder> {
	if (input.scope !== "media" && !Object.hasOwn(ctx.schema.collections, input.scope)) {
		throw new MontiError("BAD_REQUEST", `No collection or media has the scope "${input.scope}"`);
	}
	const folder = {
		id: input.__preset_id ?? randomUUID(),
		scope: input.scope,
		name: input.name,
		parent_id: input.parent_id ?? null,
	};
	if (folder.parent_id !== null) await rejectParent(ctx, folder.parent_id, folder.scope);
	return ctx.db.insertInto("folders").values(folder).returning(SHOWN).executeTakeFirstOrThrow();
}

/** Whether `id` is an active folder of `scope`. */
export async function isActiveFolder(ctx: ReadContext, id: string, scope: string): Promise<boolean> {
	const folder = await ctx.db
		.selectFrom("folders")
		.select("id")
		.where("id", "=", id)
		.where("scope", "=", scope)
		.where("trashed_at", "is", null)
		.executeTakeFirst();
	return folder !== undefined;
}

/** Rejects a parent that is not an active folder of `scope`. */
async function rejectParent(ctx: WriteContext, parentId: string, scope: string): Promise<void> {
	if (!(await isActiveFolder(ctx, parentId, scope))) {
		throw new MontiError("BAD_REQUEST", "The parent is not an active folder of this scope");
	}
}

/** The active folders of `scope` directly under `parentId`, or at the root when it is null. */
export function activeChildren(ctx: ReadContext, scope: string, parentId: string | null) {
	const query = ctx.db
		.selectFrom("folders")
		.select(["id", "name"])
		.where("scope", "=", scope)
		.where("trashed_at", "is", null);
	return parentId === null ? query.where("parent_id", "is", null) : query.where("parent_id", "=", parentId);
}

const updateInput = z.object({
	id: uuidInput,
	name: z.string().min(1).optional(),
	parent_id: uuidInput.nullable().optional(),
});

/**
 * 활성 폴더의 이름을 바꾸거나 옮긴다. `parent_id`가 null이면 루트로 옮기고, 생략한 항목은 그대로 둔다. 이름을 늘 저장하므로
 * 바꿀 항목이 없으면 기존 폴더를 그대로 돌려준다. 옮긴 위치의 활성 폴더와 이름이 겹치면 DB 고유 색인이 `CONFLICT`로 막는다.
 */
async function updateFolder(input: z.infer<typeof updateInput>, ctx: WriteContext): Promise<Folder> {
	const target = await lockedTarget(ctx, input.id);
	if (typeof input.parent_id === "string") {
		await rejectParent(ctx, input.parent_id, target.scope);
		await rejectCycle(ctx, input.id, input.parent_id);
	}
	return ctx.db
		.updateTable("folders")
		.set({ name: input.name ?? target.name, parent_id: input.parent_id })
		.where("id", "=", input.id)
		.returning(SHOWN)
		.executeTakeFirstOrThrow();
}

/**
 * 고칠 활성 폴더 `id`. 그 `scope`의 폴더 구조 잠금을 먼저 잡고 읽으므로, 겹친 이동·휴지통 이동이 커밋된 뒤의 이름과 부모를
 * 본다. 활성 폴더가 아니면 `NOT_FOUND`다.
 */
async function lockedTarget(ctx: WriteContext, id: string): Promise<Folder> {
	const found = await ctx.db.selectFrom("folders").select("scope").where("id", "=", id).executeTakeFirst();
	if (found !== undefined) await lockFolderScope(ctx.db, found.scope);
	const target = await ctx.db
		.selectFrom("folders")
		.select(SHOWN)
		.where("id", "=", id)
		.where("trashed_at", "is", null)
		.executeTakeFirst();
	if (target === undefined) throw new MontiError("NOT_FOUND", "이 `id`의 활성 폴더가 없다");
	return target;
}

/** Rejects a move under the folder itself or one of its descendants: `id` among the new parent's ancestors, itself included. */
async function rejectCycle(ctx: WriteContext, id: string, parentId: string): Promise<void> {
	const reached = await ctx.db
		.withRecursive("ancestors(id, parent_id)", (db) =>
			db
				.selectFrom("folders")
				.select(["id", "parent_id"])
				.where("id", "=", parentId)
				.union((up) =>
					up
						.selectFrom("folders")
						.innerJoin("ancestors", "ancestors.parent_id", "folders.id")
						.select(["folders.id", "folders.parent_id"]),
				),
		)
		.selectFrom("ancestors")
		.select("id")
		.where("id", "=", id)
		.executeTakeFirst();
	if (reached !== undefined)
		throw new MontiError("BAD_REQUEST", "A folder cannot move under itself or its descendants");
}

/** The `folders` resource: folder trees of the collections and of the media. */
export const folders = {
	list: defineRead({ input: listInput, run: listFolders }),
	create: defineWrite({ input: createInput, run: createFolder }),
	update: defineWrite({ input: updateInput, run: updateFolder }),
};
