import { z } from "zod";
import type { ReadContext } from "../../engine/types";
import { uuidInput } from "../_shared/input";
import { translationRows } from "./rows";
import { type Status, statusOf, type TranslationStatus } from "./status";

export const listInput = z.object({
	id: uuidInput.optional(),
	collection: z.string().optional(),
	locale: z.string().optional(),
});

/** One translation locale of an active entry, with how many of its fields and body blocks are outdated and unseen. */
interface StatusCount {
	id: string;
	collection: string;
	locale: string;
	source_locale: string;
	outdated_count: number;
	unseen_count: number;
}

/** A row for each translation locale of the active entries that match every given filter. */
export async function listStatus(input: z.infer<typeof listInput>, ctx: ReadContext): Promise<StatusCount[]> {
	let query = translationRows(ctx);
	if (input.id !== undefined) query = query.where("entries.id", "=", input.id);
	if (input.collection !== undefined) query = query.where("entries.collection", "=", input.collection);
	if (input.locale !== undefined) query = query.where("translation.locale", "=", input.locale);
	const rows = await query.execute();
	return rows.map((row) => countOf(statusOf(ctx, row)));
}

function countOf(status: TranslationStatus): StatusCount {
	const { id, collection, locale, source_locale, fields, blocks } = status;
	const statuses = [...Object.values(fields), ...blocks].map((unit) => unit.status);
	const count = (wanted: Status) => statuses.filter((found) => found === wanted).length;
	return { id, collection, locale, source_locale, outdated_count: count("outdated"), unseen_count: count("unseen") };
}
