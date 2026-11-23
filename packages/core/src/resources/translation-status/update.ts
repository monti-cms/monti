import { z } from "zod";
import { MontiError } from "../../engine/errors";
import type { WriteContext } from "../../engine/types";
import { collectionOf } from "../_shared/collection";
import { uuidInput } from "../_shared/input";
import { lockEntry } from "../entries/locks";
import { tablesOf } from "../entries/tables";
import { type BlockSeen, findTranslation, type SeenRecord, seenOf, type TranslationRow } from "./rows";
import { statusOf, type TranslationStatus } from "./status";
import { blockIds, bodyUnits } from "./units";

const blockChange = z.union([
	z.strictObject({ link: z.string() }),
	z.strictObject({ exclude: z.literal(true) }),
	z.null(),
]);

export const updateInput = z.object({
	id: uuidInput,
	locale: z.string(),
	fields: z.record(z.string(), z.literal(true).nullable()).optional(),
	blocks: z.record(z.string(), blockChange).optional(),
});

type UpdateInput = z.infer<typeof updateInput>;

/**
 * 번역 언어 작업본에서 원문 필드를 확인(`true`)하거나 기록을 지우고(`null`), 원문 본문 블록을 연결·번역 제외하거나
 * 기록을 지운다. 요청 전체를 검사한 뒤에 `translation_seen`만 쓴다: 다른 기록과 슬러그·필드·본문은 그대로이다. 글을 잠근 뒤
 * 다시 읽은 기록과 원문에 덧붙여, 겹친 다른 확인과 원문 언어 변경이 커밋한 것을 잃거나 이전 원문으로 기록하지 않는다.
 */
export async function updateStatus(input: UpdateInput, ctx: WriteContext): Promise<TranslationStatus> {
	await lockEntry(ctx, (await findTranslation(ctx, input)).collection, input.id);
	const row = await findTranslation(ctx, input);
	const seen = seenOf(row);
	confirmFields(ctx, seen, input.fields ?? {}, row);
	confirmBlocks(ctx, seen, input.blocks ?? {}, row);
	await tablesOf(ctx.db)
		.updateTable(`${row.collection}_data`)
		.set({ translation_seen: JSON.stringify(seen) })
		.where("entry_id", "=", row.id)
		.where("locale", "=", row.locale)
		.where("status", "=", "draft")
		.execute();
	return statusOf(ctx, await findTranslation(ctx, input));
}

/** 확인한 필드마다 지금의 원문 값을 기록한다. 컬렉션에 없는 필드 키는 거절한다. */
function confirmFields(
	ctx: WriteContext,
	seen: SeenRecord,
	changes: NonNullable<UpdateInput["fields"]>,
	row: TranslationRow,
): void {
	const keys = collectionOf(ctx, row.collection).fields;
	for (const [key, change] of Object.entries(changes)) {
		if (!Object.hasOwn(keys, key)) throw new MontiError("BAD_REQUEST", `원문에 "${key}" 필드가 없다`);
		if (change === null) delete seen.fields[key];
		else seen.fields[key] = row.source.fields[key] ?? null;
	}
}

/**
 * 연결하거나 번역 제외한 원문 블록마다 지금 모습을 기록한다. 상태를 갖는 원문 본문 블록이 아니거나, 번역 본문에 없는
 * 블록과 연결하면 거절한다.
 */
function confirmBlocks(
	ctx: WriteContext,
	seen: SeenRecord,
	changes: NonNullable<UpdateInput["blocks"]>,
	row: TranslationRow,
): void {
	const units = new Map(bodyUnits(ctx, row.source.body).map((block) => [block.id, block]));
	const linkable = blockIds(row.data.body);
	for (const [id, change] of Object.entries(changes)) {
		const block = units.get(id);
		if (block === undefined) throw new MontiError("BAD_REQUEST", `"${id}"는 상태를 갖는 원문 블록이 아니다`);
		if (change !== null && "link" in change && !linkable.has(change.link)) {
			throw new MontiError("BAD_REQUEST", `번역 본문에 "${change.link}" 블록이 없다`);
		}
		if (change === null) delete seen.blocks[id];
		else seen.blocks[id] = { ...change, seen_value: block } satisfies BlockSeen;
	}
}
