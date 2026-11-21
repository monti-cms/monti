import { isDeepStrictEqual } from "node:util";
import type { ReadContext } from "../../engine/types";
import type { Block } from "../../rich-text/types";
import { collectionOf } from "../entries/collection";
import { type BlockSeen, seenOf, type TranslationRow } from "./rows";
import { blockIds, bodyUnits } from "./units";

/** `unseen`: 기록이 없다. `seen`: 기록한 값이 지금의 원문과 같다. `outdated`: 다르다. */
export type Status = "unseen" | "seen" | "outdated";

interface FieldStatus {
	status: Status;
	seen_value?: unknown;
}

interface BlockStatus {
	id: string;
	status: Status;
	link?: string;
	exclude?: true;
	seen_value?: Block;
}

/** `translationStatus.get`과 `update`가 돌려주는 번역 언어 하나의 상태. */
export interface TranslationStatus {
	id: string;
	collection: string;
	locale: string;
	source_locale: string;
	fields: Record<string, FieldStatus>;
	/** 상태를 갖는 원문 본문 블록들, 읽는 순서로. */
	blocks: BlockStatus[];
}

/** 번역 언어 작업본에서 컬렉션의 최상위 필드마다, 상태를 갖는 원문 본문 블록마다 기록을 지금의 원문과 비교한 상태. */
export function statusOf(ctx: ReadContext, row: TranslationRow): TranslationStatus {
	const seen = seenOf(row);
	const linkable = blockIds(row.data.body);
	const keys = Object.keys(collectionOf(ctx, row.collection).fields);
	const fields = Object.fromEntries(keys.map((key) => [key, fieldStatus(seen.fields, key, row.source.fields[key])]));
	const blocks = bodyUnits(ctx, row.source.body).map((block) => blockStatus(seen.blocks, block, linkable));
	const { id, collection, locale, source_locale } = row;
	return { id, collection, locale, source_locale, fields, blocks };
}

function fieldStatus(seen: Record<string, unknown>, key: string, value: unknown): FieldStatus {
	if (!Object.hasOwn(seen, key)) return { status: "unseen" };
	const seen_value = seen[key];
	return { status: isDeepStrictEqual(seen_value, value ?? null) ? "seen" : "outdated", seen_value };
}

/** 연결한 번역 블록이 번역 본문에서 지워진 블록도 원문 변경 상태이다. */
function blockStatus(seen: Record<string, BlockSeen>, block: Block, linkable: Set<string>): BlockStatus {
	if (!Object.hasOwn(seen, block.id)) return { id: block.id, status: "unseen" };
	const record = seen[block.id];
	const linked = record.link === undefined || linkable.has(record.link);
	const same = linked && isDeepStrictEqual(record.seen_value, block);
	return { id: block.id, status: same ? "seen" : "outdated", ...record };
}
