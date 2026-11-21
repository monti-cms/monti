import { z } from "zod";
import { MontiError } from "../../engine/errors";
import type { WriteContext } from "../../engine/types";
import { uuidInput } from "../_shared/input";
import { recountEntryMediaUses } from "../media/uses";
import { collectionOf } from "./collection";
import { saveCopy } from "./copies";
import { dataInput, folderInput, slugInput } from "./inputs";
import { findEntry } from "./read";
import { tablesOf } from "./tables";
import type { CopyKey, Entry, EntryData } from "./types";
import { checkData, rejectFolder, rejectTakenSlug } from "./validate";

const updateOneInput = z.object({
	id: uuidInput,
	locale: z.string().optional(),
	slug: slugInput.optional(),
	folder_id: folderInput.optional(),
	data: dataInput.optional(),
});

const moveInput = z.object({ ids: z.array(uuidInput).nonempty(), folder_id: folderInput });

export const updateInput = z.union([updateOneInput, moveInput]);

/** 작업본의 슬러그를 바꾸고, `data`가 있으면 작업본을 통째로 교체한다. */
async function writeDraft(
	ctx: WriteContext,
	name: string,
	key: CopyKey,
	slug: string | null,
	data: EntryData | undefined,
): Promise<void> {
	if (data !== undefined) return saveCopy(ctx, name, collectionOf(ctx, name), key, { slug, data });
	await tablesOf(ctx.db)
		.updateTable(`${name}_data`)
		.set({ slug })
		.where("entry_id", "=", key.entry_id)
		.where("locale", "=", key.locale)
		.where("status", "=", key.status)
		.execute();
}

/**
 * 활성 글의 `locale`(생략하면 원문 언어) 작업본의 슬러그와 `data`, 글 전체의 폴더를 바꾼다. `data`를 바꾸면 통째로
 * 교체하고 모든 언어 기준으로 미디어 사용처를 다시 센다. 발행본은 건드리지 않는다.
 */
async function updateOne(input: z.infer<typeof updateOneInput>, ctx: WriteContext): Promise<Entry> {
	const existing = await findEntry(ctx, { id: input.id, locale: input.locale }, "draft");
	const { id, locale, collection: name } = existing;
	const collection = collectionOf(ctx, name);
	const data = input.data === undefined ? undefined : await checkData(ctx, collection, input.data);
	if (typeof input.folder_id === "string") await rejectFolder(ctx, input.folder_id, name);
	const slug = input.slug === undefined ? existing.slug : input.slug;
	await rejectTakenSlug(ctx, name, { id, locale, slug }, "draft");
	await writeDraft(ctx, name, { entry_id: id, locale, status: "draft" }, slug, data);
	if (input.folder_id !== undefined) {
		await tablesOf(ctx.db).updateTable(name).set({ folder_id: input.folder_id }).where("id", "=", id).execute();
	}
	if (data !== undefined) await recountEntryMediaUses(ctx, name, collection, id);
	return findEntry(ctx, { id, locale }, "draft");
}

/** 컬렉션마다 `ids` 가운데 그 컬렉션의 활성 글들. 하나라도 활성 글이 아니면 거절한다. */
async function activeOwners(ctx: WriteContext, ids: string[]): Promise<Map<string, string[]>> {
	const owners = new Map<string, string[]>();
	for (const name of Object.keys(ctx.schema.collections)) {
		const rows = await tablesOf(ctx.db)
			.selectFrom(name)
			.select("id")
			.where("id", "in", ids)
			.where("trashed_at", "is", null)
			.execute();
		if (rows.length > 0)
			owners.set(
				name,
				rows.map((row) => String(row.id)),
			);
	}
	const found = [...owners.values()].flat().length;
	if (found !== ids.length) throw new MontiError("NOT_FOUND", "활성 글이 아닌 `id`가 있다");
	return owners;
}

/** 활성 글들을 그 컬렉션의 활성 폴더 하나로, `folder_id: null`이면 루트로 옮긴다. */
async function moveEntries(input: z.infer<typeof moveInput>, ctx: WriteContext) {
	const owners = await activeOwners(ctx, [...new Set(input.ids)]);
	const moved = [];
	for (const [name, ids] of owners) {
		if (input.folder_id !== null) await rejectFolder(ctx, input.folder_id, name);
		const rows = await tablesOf(ctx.db)
			.updateTable(name)
			.set({ folder_id: input.folder_id })
			.where("id", "in", ids)
			.returning(["id", "folder_id"])
			.execute();
		moved.push(...rows.map((row) => ({ id: String(row.id), folder_id: row.folder_id as string | null })));
	}
	return moved;
}

/** `id`로 글 하나의 작업본을, `ids`로 여러 글의 폴더 이동을. */
export async function updateEntries(input: z.infer<typeof updateInput>, ctx: WriteContext) {
	return "ids" in input ? moveEntries(input, ctx) : updateOne(input, ctx);
}
