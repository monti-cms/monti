import type { z } from "zod";
import { defineRead, defineWrite } from "../../engine/operation";
import type { ReadContext } from "../../engine/types";
import { entryLocaleInput } from "../entries/inputs";
import { listInput, listStatus } from "./list";
import { findTranslation } from "./rows";
import { statusOf, type TranslationStatus } from "./status";
import { updateInput, updateStatus } from "./update";

/** 활성 글의 번역 언어 하나에서 원문 필드·본문 블록마다의 상태. */
async function getStatus(input: z.infer<typeof entryLocaleInput>, ctx: ReadContext): Promise<TranslationStatus> {
	return statusOf(ctx, await findTranslation(ctx, input));
}

/**
 * `translationStatus` 리소스: 번역 언어마다 번역하는 사람이 확인한 원문을 `<collection>_data.translation_seen`에
 * 기록해 두고, 읽을 때마다 지금의 원문과 비교한다.
 */
export const translationStatus = {
	get: defineRead({ input: entryLocaleInput, run: getStatus }),
	list: defineRead({ input: listInput, run: listStatus }),
	update: defineWrite({ emit: true, input: updateInput, run: updateStatus }),
};
