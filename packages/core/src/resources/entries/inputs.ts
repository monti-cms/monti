import { z } from "zod";
import { uuidInput } from "../_shared/input";

/** 초안의 슬러그: 비워 둘 수 있다(`null`). */
export const slugInput = z
	.string()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
	.nullable();

export const dataInput = z.object({
	fields: z.record(z.string(), z.unknown()).optional(),
	body: z.unknown().optional(),
});

/** 폴더: `null`이면 루트다. */
export const folderInput = uuidInput.nullable();

/** 글과 그 언어 하나: `entries.removeLocale`과 `entries.setSourceLocale`의 입력. */
export const entryLocaleInput = z.object({ id: uuidInput, locale: z.string() });
