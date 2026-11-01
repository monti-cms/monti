import { describe, expect, it } from "vitest";
import { testSite } from "../../../test/site";
import { createTranslator } from "../../i18n";
import { noticeText } from "../error-notice";
import { noticeMessages } from "../error-notices.messages";
import { CmsError, type NoticeRef } from "../store/errors";

/** The notice a function throws as an error (`undefined` when it throws none, or throws something else). */
const _noticeOf = (run: () => unknown): NoticeRef | undefined => {
	try {
		run();
	} catch (error) {
		return error instanceof CmsError && error.notice && "key" in error.notice ? error.notice : undefined;
	}
	return undefined;
};

const placeholdersOf = (text: unknown) =>
	typeof text === "string" ? [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort() : [];

describe("core notice dictionary", () => {
	const en = noticeMessages.messages.en;
	const ko = noticeMessages.messages.ko ?? {};

	it("ADMIN-E3 has the same keys in English and Korean", () => {
		expect(Object.keys(ko).sort()).toEqual(Object.keys(en).sort());
	});

	it("ADMIN-E3 shows the same values in both languages for every key, and leaves no {placeholder} unfilled", () => {
		for (const key of Object.keys(en) as (keyof typeof en)[]) {
			const names = [...new Set([...placeholdersOf(en[key]), ...placeholdersOf(ko[key])])];
			const vars = Object.fromEntries(names.map((name) => [name, `<${name}>`]));
			const shown = (language: string) => {
				const text = createTranslator(noticeMessages, language)(key, vars);
				expect(text, `${language} ${key}`).not.toMatch(/\{\w+\}/);
				return names.filter((name) => text.includes(`<${name}>`));
			};
			expect(shown("ko"), key).toEqual(shown("en"));
		}
	});
});

describe("notices of the domain rules", () => {
	const t = testSite.createTranslator(noticeMessages);

	it("ADMIN-E1 every notice above has the text and a way out in the admin language", () => {
		for (const key of ["entry.duplicate.trashed", "entry.delete.not_trashed", "entry.publish.trashed"] as const) {
			const text = noticeText(testSite, { code: "invalid_status", notice: { key } });
			expect(text.what).toBe(t(key));
			expect(text.fix).toBe(t(`${key}.fix`));
		}
	});
});
