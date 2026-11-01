import { describe, expect, it } from "vitest";
import { localesFromFileNames } from "../locale-names";

describe("languages found in the content files", () => {
	it("INIT-Q3 reads suffixes like hello.ko.mdx, and puts first the language whose files have no pair", () => {
		const found = localesFromFileNames(["hello.en.mdx", "hello.ko.mdx", "about.ko.mdx", "tips.ko.mdx"]);
		expect(found?.map((locale) => locale.code)).toEqual(["ko", "en"]);
		expect(found?.[0]).toMatchObject({ files: 3, unpaired: 2 });
		expect(found?.[1]).toMatchObject({ files: 1, unpaired: 0 });
	});

	it("INIT-Q3 takes the first language when every file has a pair", () => {
		expect(localesFromFileNames(["a.en.md", "a.ko.md", "b.en.md", "b.ko.md"])?.map((l) => l.code)).toEqual([
			"en",
			"ko",
		]);
	});

	it("INIT-Q3 does not take a name for a language", () => {
		expect(localesFromFileNames(["release.notes.md", "api.min.md", "a.md"])).toBeUndefined();
		// one file alone is more likely a name
		expect(localesFromFileNames(["notes.it.md", "a.md"])).toBeUndefined();
	});

	it("INIT-Q3 a file with no suffix next to a suffixed one counts as its pair", () => {
		const found = localesFromFileNames(["hello.mdx", "hello.ko.mdx", "bye.ko.mdx", "only.ko.mdx"]);
		expect(found?.[0]).toMatchObject({ code: "ko", files: 3, unpaired: 2 });
	});
});
