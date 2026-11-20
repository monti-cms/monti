import { z } from "zod";
import { MontiError } from "../../engine/errors";
import type { CollectionSchema, FieldSchema, WriteContext } from "../../engine/types";
import { uuidInput } from "../_shared/input";
import { fieldOf, isKnownOption } from "./fields";

export const replaceInput = z.object({ from_id: uuidInput, into_id: uuidInput });

/** Which references change: relations to `collection` that hold `from` come to hold `into`. */
interface Swap {
	collection: string;
	from: string;
	into: string;
}

/**
 * The collection of `from_id` and `into_id`. Rejects a missing entry or a trashed `into_id` (a trashed `from_id` is
 * allowed), and the same entry or entries of different collections.
 */
async function collectionOfBoth(ctx: WriteContext, input: z.infer<typeof replaceInput>): Promise<string> {
	const rows = await ctx.db
		.selectFrom("entries")
		.select(["id", "collection", "trashed_at"])
		.where("id", "in", [input.from_id, input.into_id])
		.execute();
	const from = rows.find((row) => row.id === input.from_id);
	const into = rows.find((row) => row.id === input.into_id);
	if (from === undefined || into === undefined || into.trashed_at !== null) {
		throw new MontiError("NOT_FOUND", "from_id and into_id must be entries and into_id must be active");
	}
	if (from.id === into.id || from.collection !== into.collection) {
		throw new MontiError("BAD_REQUEST", "from_id and into_id must be two entries of one collection");
	}
	return from.collection;
}

/** A relation value with `from` swapped for `into`; a list keeps `into` once, at its first place. */
function swapIds(value: unknown, swap: Swap): unknown {
	if (!Array.isArray(value)) return value === swap.from ? swap.into : value;
	if (!value.includes(swap.from)) return value;
	const swapped = value.map((id) => (id === swap.from ? swap.into : id));
	return swapped.filter((id, index) => id !== swap.into || swapped.indexOf(id) === index);
}

/**
 * Field values with the swap applied to every relation to the swap's collection, a chosen option's included. A key or an
 * option the schema no longer has keeps its stored value.
 */
function swapFields(fields: Record<string, FieldSchema>, values: Record<string, unknown>, swap: Swap) {
	return Object.fromEntries(
		Object.entries(values).map(([key, value]) => {
			const field = fieldOf(fields, key);
			return [key, field === undefined ? value : swapValue(field, value, swap)];
		}),
	);
}

function swapValue(field: FieldSchema, value: unknown, swap: Swap): unknown {
	if (field.type === "conditional") {
		if (!isKnownOption(field, value)) return value;
		return { ...value, fields: swapFields(field.options[value.option].fields, value.fields, swap) };
	}
	return field.type === "relation" && field.to === swap.collection ? swapIds(value, swap) : value;
}

/** `data` with the swap applied, as JSON, or undefined when the swap changes nothing. */
function swappedData(collection: CollectionSchema, data: Record<string, unknown>, swap: Swap) {
	const fields = swapFields(collection.fields, data.fields as Record<string, unknown>, swap);
	const json = JSON.stringify({ ...data, fields });
	return json === JSON.stringify(data) ? undefined : json;
}

/** The working or published copies of a collection's entries in every locale, trashed entries included. */
type CopyTable = "entry_locales" | "entry_published";

/** Applies the swap to the copies in `table` of a collection's entries; returns the ids of the entries it changed. */
async function swapInTable(
	ctx: WriteContext,
	table: CopyTable,
	name: string,
	collection: CollectionSchema,
	swap: Swap,
) {
	const rows = await ctx.db
		.selectFrom(table)
		.select(["entry_id", "locale", "data"])
		.where("entry_id", "in", ctx.db.selectFrom("entries").select("id").where("collection", "=", name))
		.execute();
	const updated: string[] = [];
	for (const row of rows) {
		const data = swappedData(collection, row.data, swap);
		if (data === undefined) continue;
		await ctx.db
			.updateTable(table)
			.set({ data })
			.where("entry_id", "=", row.entry_id)
			.where("locale", "=", row.locale)
			.execute();
		updated.push(row.entry_id);
	}
	return updated;
}

/**
 * Points every relation to `from_id` at `into_id` instead, in every locale's working and published copies; `from_id` is
 * kept as it is. `updated_ids` has each changed entry once.
 */
export async function replaceReferences(input: z.infer<typeof replaceInput>, ctx: WriteContext) {
	const swap = { collection: await collectionOfBoth(ctx, input), from: input.from_id, into: input.into_id };
	const updated = new Set<string>();
	for (const [name, collection] of Object.entries(ctx.schema.collections)) {
		for (const table of ["entry_locales", "entry_published"] as const) {
			for (const id of await swapInTable(ctx, table, name, collection, swap)) updated.add(id);
		}
	}
	return { from_id: input.from_id, into_id: input.into_id, updated_ids: [...updated] };
}
