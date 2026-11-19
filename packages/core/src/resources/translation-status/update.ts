import { z } from "zod";
import { MontiError } from "../../engine/errors";
import type { WriteContext } from "../../engine/types";
import { uuidInput } from "../_shared/input";
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
 * Confirms (`true`) or forgets (`null`) source fields, and links, excludes or forgets source body blocks in a translation
 * locale. The whole request is checked before `translation_seen` is written; other records, the slug and the data stay.
 */
export async function updateStatus(input: UpdateInput, ctx: WriteContext): Promise<TranslationStatus> {
	const row = await findTranslation(ctx, input);
	const seen = seenOf(row);
	confirmFields(seen, input.fields ?? {}, row);
	confirmBlocks(ctx, seen, input.blocks ?? {}, row);
	await ctx.db
		.updateTable("entry_locales")
		.set({ translation_seen: JSON.stringify(seen) })
		.where("entry_id", "=", row.id)
		.where("locale", "=", row.locale)
		.execute();
	return statusOf(ctx, await findTranslation(ctx, input));
}

/** Records the current source value of each confirmed field; rejects a key the source `data.fields` does not have. */
function confirmFields(seen: SeenRecord, changes: NonNullable<UpdateInput["fields"]>, row: TranslationRow): void {
	const source = row.source_data.fields;
	for (const [key, change] of Object.entries(changes)) {
		if (!Object.hasOwn(source, key)) throw new MontiError("BAD_REQUEST", `The source has no field "${key}"`);
		if (change === null) delete seen.fields[key];
		else seen.fields[key] = source[key];
	}
}

/**
 * Records each linked or excluded source block as it is now; rejects a block that is not a source body block with a
 * status, and a link to a block the translation body does not have.
 */
function confirmBlocks(
	ctx: WriteContext,
	seen: SeenRecord,
	changes: NonNullable<UpdateInput["blocks"]>,
	row: TranslationRow,
): void {
	const units = new Map(bodyUnits(ctx, row.source_data.body).map((block) => [block.id, block]));
	const linkable = blockIds(row.data.body);
	for (const [id, change] of Object.entries(changes)) {
		const block = units.get(id);
		if (block === undefined) throw new MontiError("BAD_REQUEST", `"${id}" is not a source block with a status`);
		if (change !== null && "link" in change && !linkable.has(change.link)) {
			throw new MontiError("BAD_REQUEST", `The translation body has no block "${change.link}"`);
		}
		if (change === null) delete seen.blocks[id];
		else seen.blocks[id] = { ...change, seen_value: block } satisfies BlockSeen;
	}
}
