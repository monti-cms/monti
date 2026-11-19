import type { z } from "zod";
import { defineRead, defineWrite } from "../../engine/operation";
import type { ReadContext } from "../../engine/types";
import { entryLocaleInput } from "../entries/locales";
import { listInput, listStatus } from "./list";
import { findTranslation } from "./rows";
import { statusOf, type TranslationStatus } from "./status";
import { updateInput, updateStatus } from "./update";

/** The status of every source field and body block in one translation locale of an active entry. */
async function getStatus(input: z.infer<typeof entryLocaleInput>, ctx: ReadContext): Promise<TranslationStatus> {
	return statusOf(ctx, await findTranslation(ctx, input));
}

/**
 * The `translationStatus` resource: what a translator confirmed of the source in each translation locale, kept in
 * `entry_locales.translation_seen` and compared with the source on every read.
 */
export const translationStatus = {
	get: defineRead({ input: entryLocaleInput, run: getStatus }),
	list: defineRead({ input: listInput, run: listStatus }),
	update: defineWrite({ input: updateInput, run: updateStatus }),
};
