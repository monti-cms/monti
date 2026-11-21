import type { MediaUsesTable } from "../../db/types";
import { MontiError } from "../../engine/errors";
import type { CollectionSchema, WriteContext } from "../../engine/types";
import type { Block, Doc } from "../../rich-text/types";
import { decodeData, everyTarget } from "../entries/decode";
import { copyQuery, storedOf } from "../entries/read";
import { valuesOf } from "../entries/slots";

/** `media_uses` 행을 쓰는 글이나 템플릿. */
interface UseSource {
	source_kind: MediaUsesTable["source_kind"];
	source_id: string;
}

/** `field_path`마다 참조하는 미디어 `id`들. 소문자로, 경로마다 한 번씩. */
type UsesByPath = Map<string, Set<string>>;

/** 블록과 그 자식들이 `attrs.mediaId`나 `attrs.mediaIds`로 참조하는 모든 미디어 `id`. 소문자로, 한 번씩. */
function mediaIdsOf(blocks: readonly Block[], ids = new Set<string>()): Set<string> {
	for (const block of blocks) {
		const { mediaId, mediaIds } = block.attrs ?? {};
		if (typeof mediaId === "string") ids.add(mediaId.toLowerCase());
		if (Array.isArray(mediaIds)) for (const id of mediaIds) if (typeof id === "string") ids.add(id.toLowerCase());
		mediaIdsOf(block.children ?? [], ids);
	}
	return ids;
}

/** 사용처가 참조하는 모든 미디어 `id`. 한 번씩. */
function idsOf(uses: UsesByPath): string[] {
	return [...new Set([...uses.values()].flatMap((pathIds) => [...pathIds]))];
}

/** `media`에 없거나 휴지통에 있는 미디어를 참조하면 거절한다. */
async function rejectInactive(ctx: WriteContext, ids: readonly string[]): Promise<void> {
	// `in ()`는 SQL이 아니다: 미디어가 없으면 검사할 것도 없다.
	if (ids.length === 0) return;
	const active = await ctx.db
		.selectFrom("media")
		.select("id")
		.where("id", "in", ids)
		.where("trashed_at", "is", null)
		.execute();
	if (active.length !== ids.length) throw new MontiError("BAD_REQUEST", "활성 상태가 아닌 미디어를 참조한다");
}

/** 사용처의 `media_uses` 행을 지운다. */
export async function removeMediaUses(ctx: WriteContext, source: UseSource): Promise<void> {
	await ctx.db
		.deleteFrom("media_uses")
		.where("source_kind", "=", source.source_kind)
		.where("source_id", "=", source.source_id)
		.execute();
}

/** 사용처의 `media_uses` 행을 `uses`로 바꾼다. */
async function writeUses(ctx: WriteContext, source: UseSource, uses: UsesByPath): Promise<void> {
	await removeMediaUses(ctx, source);
	const rows = [...uses].flatMap(([field_path, pathIds]) =>
		[...pathIds].map((media_id) => ({ media_id, ...source, field_path })),
	);
	// 빈 `values`는 SQL이 아니다: 미디어가 없으면 행도 없다.
	if (rows.length > 0) await ctx.db.insertInto("media_uses").values(rows).execute();
}

/** 사용처의 `media_uses` 행을 `doc`이 `field_path`에서 참조하는 미디어로 바꾼다. 활성이 아닌 미디어는 거절한다. */
export async function replaceMediaUses(
	ctx: WriteContext,
	source: UseSource,
	field_path: string,
	doc: Doc,
): Promise<void> {
	const uses: UsesByPath = new Map([[field_path, mediaIdsOf(doc.blocks)]]);
	await rejectInactive(ctx, idsOf(uses));
	await writeUses(ctx, source, uses);
}

/** `ids`를 `uses`의 `field_path` 칸에 소문자로 더한다. */
function addUses(uses: UsesByPath, field_path: string, ids: Iterable<string>): void {
	const pathIds = uses.get(field_path) ?? new Set<string>();
	for (const id of ids) pathIds.add(id.toLowerCase());
	uses.set(field_path, pathIds);
}

/** 컬렉션 `name`의 활성 글 `entryId`가 모든 언어 작업본의 미디어 필드와 본문에서 참조하는 미디어, 경로별로. */
async function draftUses(ctx: WriteContext, name: string, collection: CollectionSchema, entryId: string) {
	const rows = await copyQuery(ctx, name, "draft").where("e.id", "=", entryId).execute();
	const uses: UsesByPath = new Map();
	for (const stored of await storedOf(ctx, name, rows)) {
		const data = decodeData(collection, stored, everyTarget);
		for (const { slot, value } of valuesOf(collection, data.fields)) {
			if (slot.field.type === "media") addUses(uses, slot.usePath, [value].flat() as string[]);
		}
		if (data.body !== undefined) addUses(uses, "body", mediaIdsOf(data.body.blocks));
	}
	return uses;
}

/**
 * 글의 `media_uses` 행을 그 글의 모든 언어 작업본이 참조하는 존재하는 미디어(휴지통 포함)의 합집합으로 바꾼다. 본문은
 * `"body"`, 최상위 미디어 필드는 `"fields.<key>"`, 조건부 하위 미디어 필드는 `"fields.<key>.fields.<sub>"` 경로다.
 */
export async function recountEntryMediaUses(
	ctx: WriteContext,
	name: string,
	collection: CollectionSchema,
	entryId: string,
): Promise<void> {
	const uses = await draftUses(ctx, name, collection, entryId);
	const ids = idsOf(uses);
	const existing =
		ids.length === 0
			? new Set<string>()
			: new Set((await ctx.db.selectFrom("media").select("id").where("id", "in", ids).execute()).map((r) => r.id));
	for (const pathIds of uses.values()) for (const id of pathIds) if (!existing.has(id)) pathIds.delete(id);
	await writeUses(ctx, { source_kind: "entry", source_id: entryId }, uses);
}
