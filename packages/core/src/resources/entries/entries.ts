import { z } from "zod";
import { defineRead, defineWrite } from "../../engine/operation";
import type { ReadContext } from "../../engine/types";
import { uuidInput } from "../_shared/input";
import { createEntry, createInput } from "./create";
import { duplicateEntry, duplicateInput } from "./duplicate";
import { entryLocaleInput, folderInput } from "./inputs";
import { listEntries } from "./list";
import { addLocale, addLocaleInput, removeLocale, setSourceLocale } from "./locales";
import { publishEntry, publishInput, unpublishEntry, unpublishInput } from "./publish";
import { findEntry } from "./read";
import { replaceInput, replaceReferences } from "./references";
import type { Entry } from "./types";
import { updateEntries, updateInput } from "./update";

const statusInput = z.enum(["published", "draft"]).optional();

const getInput = z.union([
	z.object({ id: uuidInput, locale: z.string().optional(), status: statusInput }),
	z.object({ collection: z.string(), locale: z.string(), slug: z.string(), status: statusInput }),
]);

/** 한 언어의 글: 발행본, `status: "draft"`이면 작업본. */
async function getEntry(input: z.infer<typeof getInput>, ctx: ReadContext): Promise<Entry> {
	const { status, ...key } = input;
	return findEntry(ctx, key, status ?? "published");
}

const listInput = z.object({
	collection: z.string().optional(),
	locale: z.string().optional(),
	folder_id: folderInput.optional(),
	relation: z.object({ field: z.string(), id: uuidInput }).optional(),
	status: statusInput,
});

/** `entries` 리소스: 모든 컬렉션 글의 언어별 작업본과 발행본. */
export const entries = {
	create: defineWrite({ input: createInput, run: createEntry }),
	get: defineRead({ input: getInput, run: getEntry }),
	list: defineRead({ input: listInput, run: listEntries }),
	update: defineWrite({ input: updateInput, run: updateEntries }),
	publish: defineWrite({ input: publishInput, run: publishEntry }),
	unpublish: defineWrite({ input: unpublishInput, run: unpublishEntry }),
	duplicate: defineWrite({ input: duplicateInput, run: duplicateEntry }),
	replaceReferences: defineWrite({ input: replaceInput, run: replaceReferences }),
	addLocale: defineWrite({ input: addLocaleInput, run: addLocale }),
	removeLocale: defineWrite({ input: entryLocaleInput, run: removeLocale }),
	setSourceLocale: defineWrite({ input: entryLocaleInput, run: setSourceLocale }),
};
