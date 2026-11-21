import { randomUUID } from "node:crypto";
import { z } from "zod";
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

/** Makes a folder in `"media"` or a schema collection, under an active folder of the same scope when given one. */
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
	await rejectTaken(ctx, folder);
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

/** Rejects a name another active folder already has under the same parent of the same scope; `id` is the folder itself, left out. */
async function rejectTaken(ctx: WriteContext, folder: Folder): Promise<void> {
	const taken = await activeChildren(ctx, folder.scope, folder.parent_id)
		.where("id", "<>", folder.id)
		.where("name", "=", folder.name)
		.executeTakeFirst();
	if (taken !== undefined) throw new MontiError("CONFLICT", "An active folder here already has this name");
}

const updateInput = z.object({
	id: uuidInput,
	name: z.string().min(1).optional(),
	parent_id: uuidInput.nullable().optional(),
});

/**
 * 활성 폴더의 이름을 바꾸거나 옮긴다. `parent_id`가 null이면 루트로 옮기고, 생략한 항목은 그대로 둔다. 바뀐 뒤의 이름과
 * 부모를 늘 함께 저장하므로 바꿀 항목이 없으면 기존 폴더를 그대로 돌려준다.
 */
async function updateFolder(input: z.infer<typeof updateInput>, ctx: WriteContext): Promise<Folder> {
	const target = await ctx.db
		.selectFrom("folders")
		.select(SHOWN)
		.where("id", "=", input.id)
		.where("trashed_at", "is", null)
		.executeTakeFirst();
	if (target === undefined) throw new MontiError("NOT_FOUND", "이 `id`의 활성 폴더가 없다");
	if (typeof input.parent_id === "string") {
		await rejectParent(ctx, input.parent_id, target.scope);
		await rejectCycle(ctx, input.id, input.parent_id);
	}
	const parentId = input.parent_id === undefined ? target.parent_id : input.parent_id;
	const next = { ...target, name: input.name ?? target.name, parent_id: parentId };
	await rejectTaken(ctx, next);
	return ctx.db
		.updateTable("folders")
		.set({ name: next.name, parent_id: next.parent_id })
		.where("id", "=", input.id)
		.returning(SHOWN)
		.executeTakeFirstOrThrow();
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
