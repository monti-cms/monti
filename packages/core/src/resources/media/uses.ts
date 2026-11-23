import type { MediaUsesTable } from "../../db/types";
import type { CollectionSchema, WriteContext } from "../../engine/types";
import type { Doc } from "../../rich-text/types";
import { bodyReferences, type References, referencesIn, rejectInactive } from "../entries/active";
import { decodeData, everyTarget } from "../entries/decode";
import { copyQuery, storedOf } from "../entries/read";

/** `media_uses` 행을 쓰는 글이나 템플릿. */
interface UseSource {
	source_kind: MediaUsesTable["source_kind"];
	source_id: string;
}

/** `field_path`마다 참조하는 미디어 `id`들. 소문자로, 경로마다 한 번씩. */
type UsesByPath = Map<string, Set<string>>;

/** `refs`의 경로마다 그 미디어 `id`들. `refs`에는 미디어 필드와 본문 경로만 모은다. */
function usesOf(refs: References): UsesByPath {
	const uses: UsesByPath = new Map();
	for (const [field_path, { ids }] of refs) uses.set(field_path, ids);
	return uses;
}

/** 사용처가 참조하는 모든 미디어 `id`. 한 번씩. */
function idsOf(uses: UsesByPath): string[] {
	return [...new Set([...uses.values()].flatMap((pathIds) => [...pathIds]))];
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

/**
 * `uses`가 참조하는 미디어 행을 이 트랜잭션이 끝날 때까지 영구 삭제되지 않게 잠근다. 이미 지우는 중인 행은 그 삭제가 끝날
 * 때까지 기다려, 뒤이은 판정이 삭제된 뒤의 상태를 보게 한다. 영구 삭제처럼 `id` 순서로 잠가, 여러 미디어를 겹쳐 잠그는
 * 쓰기끼리 서로 기다리다 멈추지 않는다.
 */
async function lockUsedMedia(ctx: WriteContext, uses: UsesByPath): Promise<void> {
	const ids = idsOf(uses);
	// `in ()`는 SQL이 아니다: 참조가 없으면 잠글 것도 없다.
	if (ids.length === 0) return;
	await ctx.db.selectFrom("media").select("id").where("id", "in", ids).orderBy("id").forKeyShare().execute();
}

/**
 * 사용처의 `media_uses` 행을 `doc`이 `field_path`에서 참조하는 미디어로 바꾼다. 없는 미디어와 휴지통에 있는 미디어는
 * 거절하되, `kept`(고치기 전의 본문)에 이미 있던 미디어는 휴지통에 있어도 받는다.
 */
export async function replaceMediaUses(
	ctx: WriteContext,
	source: UseSource,
	field_path: string,
	doc: Doc,
	kept?: Doc,
): Promise<void> {
	const refs = bodyReferences(field_path, doc);
	await lockUsedMedia(ctx, usesOf(refs));
	await rejectInactive(ctx, refs, bodyReferences(field_path, kept));
	await writeUses(ctx, source, usesOf(refs));
}

/** 컬렉션 `name`의 활성 글 `entryId`가 모든 언어 작업본의 미디어 필드와 본문에서 참조하는 미디어, 경로별로. */
async function draftUses(ctx: WriteContext, name: string, collection: CollectionSchema, entryId: string) {
	const rows = await copyQuery(ctx, name, "draft").where("e.id", "=", entryId).execute();
	const refs: References = new Map();
	for (const stored of await storedOf(ctx, name, rows)) {
		const data = decodeData(collection, stored, everyTarget);
		bodyReferences("body", data.body, referencesIn(collection, data.fields, refs, "media"));
	}
	return usesOf(refs);
}

/**
 * 글의 `media_uses` 행을 그 글의 모든 언어 작업본이 참조하는 존재하는 미디어(휴지통 포함)의 합집합으로 바꾼다. 본문은
 * `"body"`, 최상위 미디어 필드는 `"<key>"`, 조건부 하위 미디어 필드는 `"<key>.<option>.<sub>"` 경로다(`_rels.path`와 같다).
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
