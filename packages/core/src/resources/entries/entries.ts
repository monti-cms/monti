import { z } from "zod";
import { defineRead, defineWrite } from "../../engine/operation";
import type { ReadContext } from "../../engine/types";
import { uuidInput } from "../_shared/input";
import { createEntry, createInput, folderInput } from "./create";
import { duplicateEntry, duplicateInput } from "./duplicate";
import { publishEntry, publishInput, unpublishEntry, unpublishInput } from "./publish";
import { type Entry, findEntry, listEntries } from "./query";
import { replaceInput, replaceReferences } from "./references";
import { updateEntries, updateInput } from "./update";

const draftInput = z.boolean().optional();

const getInput = z.union([
	z.object({ id: uuidInput, locale: z.string().optional(), draft: draftInput }),
	z.object({ collection: z.string(), locale: z.string(), slug: z.string(), draft: draftInput }),
]);

/** An entry in one locale: its published copy, or its working copy with `draft: true`. */
async function getEntry(input: z.infer<typeof getInput>, ctx: ReadContext): Promise<Entry> {
	const { draft, ...key } = input;
	return findEntry(ctx, key, draft);
}

const listInput = z.object({
	collection: z.string().optional(),
	locale: z.string().optional(),
	folder_id: folderInput.optional(),
	relation: z.object({ field: z.string(), id: uuidInput }).optional(),
	draft: draftInput,
});

/** The published copies of the matching entries, or their working copies with `draft: true`. */
async function listAll(input: z.infer<typeof listInput>, ctx: ReadContext): Promise<Entry[]> {
	const { draft, ...filter } = input;
	return listEntries(ctx, filter, draft);
}

/** The `entries` resource: the working and published copies of every collection's entries, in each locale. */
export const entries = {
	create: defineWrite({ input: createInput, run: createEntry }),
	get: defineRead({ input: getInput, run: getEntry }),
	list: defineRead({ input: listInput, run: listAll }),
	update: defineWrite({ input: updateInput, run: updateEntries }),
	publish: defineWrite({ input: publishInput, run: publishEntry }),
	unpublish: defineWrite({ input: unpublishInput, run: unpublishEntry }),
	duplicate: defineWrite({ input: duplicateInput, run: duplicateEntry }),
	replaceReferences: defineWrite({ input: replaceInput, run: replaceReferences }),
};
