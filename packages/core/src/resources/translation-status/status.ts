import { isDeepStrictEqual } from "node:util";
import type { ReadContext } from "../../engine/types";
import type { Block } from "../../rich-text/types";
import { type BlockSeen, seenOf, type TranslationRow } from "./rows";
import { blockIds, bodyUnits } from "./units";

/** `unseen`: nothing confirmed; `seen`: the confirmed value is the source's current one; `outdated`: it is not. */
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

/** What `translationStatus.get` and `update` return of one translation locale. */
export interface TranslationStatus {
	id: string;
	collection: string;
	locale: string;
	source_locale: string;
	fields: Record<string, FieldStatus>;
	/** The source body blocks with a status, in reading order. */
	blocks: BlockStatus[];
}

/** The status of every source field and source body block in a translation locale, compared with its record now. */
export function statusOf(ctx: ReadContext, row: TranslationRow): TranslationStatus {
	const seen = seenOf(row);
	const linkable = blockIds(row.data.body);
	const fields = Object.fromEntries(
		Object.entries(row.source_data.fields).map(([key, value]) => [key, fieldStatus(seen.fields, key, value)]),
	);
	const blocks = bodyUnits(ctx, row.source_data.body).map((block) => blockStatus(seen.blocks, block, linkable));
	const { id, collection, locale, source_locale } = row;
	return { id, collection, locale, source_locale, fields, blocks };
}

function fieldStatus(seen: Record<string, unknown>, key: string, value: unknown): FieldStatus {
	if (!Object.hasOwn(seen, key)) return { status: "unseen" };
	const seen_value = seen[key];
	return { status: isDeepStrictEqual(seen_value, value) ? "seen" : "outdated", seen_value };
}

/** A linked block is also outdated once its translation block is no longer in the translation body. */
function blockStatus(seen: Record<string, BlockSeen>, block: Block, linkable: Set<string>): BlockStatus {
	if (!Object.hasOwn(seen, block.id)) return { id: block.id, status: "unseen" };
	const record = seen[block.id];
	const linked = record.link === undefined || linkable.has(record.link);
	const same = linked && isDeepStrictEqual(record.seen_value, block);
	return { id: block.id, status: same ? "seen" : "outdated", ...record };
}
