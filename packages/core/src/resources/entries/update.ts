import { z } from "zod";
import { MontiError } from "../../engine/errors";
import type { WriteContext } from "../../engine/types";
import { collectionOf } from "../_shared/collection";
import { uuidInput } from "../_shared/input";
import { recountEntryMediaUses } from "../media/uses";
import { saveCopy } from "./copies";
import { dataShape, folderInput, slugInput } from "./inputs";
import { findEntry } from "./read";
import { tablesOf } from "./tables";
import type { CopyKey, Entry, EntryData } from "./types";
import { checkData, type DataInput, rejectFolder, rejectTakenSlug } from "./validate";

const updateOneInput = z.object({
	id: uuidInput,
	locale: z.string().optional(),
	slug: slugInput.optional(),
	folder_id: folderInput.optional(),
	...dataShape,
});

const moveInput = z.strictObject({ ids: z.array(uuidInput).nonempty(), folder_id: folderInput });

export const updateInput = z.union([updateOneInput, moveInput]);

/** 작업본의 슬러그를 바꾸고, 필드·본문(`data`)이 있으면 작업본을 통째로 교체한다. */
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

/** 저장할 `fields`·`body`: 둘 중 생략한 쪽은 작업본의 것을 그대로 둔다. */
function patchOf(input: DataInput, existing: EntryData): DataInput {
	return {
		fields: input.fields === undefined ? existing.fields : input.fields,
		body: input.body === undefined ? existing.body : input.body,
	};
}

/**
 * 활성 글의 `locale`(생략하면 원문 언어) 작업본의 슬러그와 필드·본문, 글 전체의 폴더를 바꾼다. `fields`를 주면 필드
 * 값 전체를, `body`를 주면 본문을 교체하고 생략한 쪽은 그대로 두며, 둘 중 하나라도 주면 모든 언어 기준으로 미디어
 * 사용처를 다시 센다. 그 작업본의 같은 경로에 이미 있던 참조는 대상이 휴지통에 있어도 그대로 둘 수 있다. 발행본은
 * 건드리지 않는다.
 */
async function updateOne(input: z.infer<typeof updateOneInput>, ctx: WriteContext): Promise<Entry> {
	const existing = await findEntry(ctx, { id: input.id, locale: input.locale }, "draft");
	const { id, locale, collection: name } = existing;
	const collection = collectionOf(ctx, name);
	const replaces = input.fields !== undefined || input.body !== undefined;
	const data = replaces ? await checkData(ctx, collection, patchOf(input, existing), existing) : undefined;
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
