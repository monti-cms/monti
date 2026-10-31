import { describe, expect, it } from "vitest";
import {
	customLocaleCode,
	findLocaleCodes,
	localeFromCode,
	localeName,
	normalizeLocaleCode,
	sourceFirst,
} from "../locale-names";

describe("locale names", () => {
	it("names a language in itself and in the admin language, from the code", () => {
		expect(localeName("ja", "ja")).toBe("日本語");
		expect(localeName("ja", "en")).toBe("Japanese");
		expect(localeName("zzz", "zzz")).toBeUndefined();
	});

	it("SET-L1 makes a row from a code: the display name only when it differs from the native one", () => {
		expect(localeFromCode("ja", "en")).toEqual({ code: "ja", name: "日本語", label: "Japanese" });
		expect(localeFromCode("en", "en")).toEqual({ code: "en", name: "English" });
		expect(localeFromCode("zzz", "en")).toBeUndefined();
	});

	it("SET-L1 normalizes the language part of a typed code", () => {
		expect(normalizeLocaleCode(" ZH_Hans ")).toBe("zh-Hans");
		expect(normalizeLocaleCode("pt-BR")).toBe("pt-BR");
	});

	it("SET-L1 finds codes in the code and in both names, and leaves out the listed ones", () => {
		expect(findLocaleCodes("zh", [], "en")).toEqual(["zh-Hans", "zh-Hant", "zh-HK"]);
		expect(findLocaleCodes("japan", [], "en")).toEqual(["ja"]);
		expect(findLocaleCodes("ja", ["ja"], "en")).toEqual([]);
		expect(findLocaleCodes("", ["ko", "en"], "en")).not.toContain("ko");
	});

	it("SET-L1 offers 'type it yourself' only for a usable code that is not listed or taken", () => {
		const listed = findLocaleCodes("zh", [], "en");
		expect(customLocaleCode("zh", [], listed)).toBe("zh");
		expect(customLocaleCode("zh-Hans", [], listed)).toBeUndefined();
		expect(customLocaleCode("tlh", ["ko"], [])).toBe("tlh");
		expect(customLocaleCode("ko", ["ko"], [])).toBeUndefined();
		expect(customLocaleCode("not a code", [], [])).toBeUndefined();
		expect(customLocaleCode("", [], [])).toBeUndefined();
	});

	it("SET-L2 puts the source first and keeps the rest in order", () => {
		const list = [
			{ code: "ko", name: "한국어" },
			{ code: "en", name: "English" },
			{ code: "ja", name: "日本語" },
		];
		expect(sourceFirst(list, "ja").map((locale) => locale.code)).toEqual(["ja", "ko", "en"]);
		expect(sourceFirst(list, "xx").map((locale) => locale.code)).toEqual(["ko", "en", "ja"]);
	});
});
