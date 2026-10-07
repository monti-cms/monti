import { describe, expect, it, vi } from "vitest";
import { testSite } from "../../test/site";
import type { AiValidatorContext } from "../action";
import { regexRuns, sameStructure, uniqueSlug } from "../validators";
import { validatorMessages } from "../validators.messages";

const validatorText = testSite.createTranslator(validatorMessages);

const context = (
	input: Record<string, unknown>,
	taken: string[] = [],
	extra: Partial<AiValidatorContext> = {},
): AiValidatorContext => ({
	input,
	locale: "ko",
	content: { slugsInUse: async ({ slugs }) => new Set(slugs.filter((slug) => taken.includes(slug))) },
	site: testSite,
	...extra,
});

describe("default code checks", () => {
	it("no-duplicate removes slugs used by other entries via the core content lookup", async () => {
		const post = { collection: "post" };
		expect(await uniqueSlug.run("taken-slug", context({}, ["taken-slug"], post))).toBe(false);
		expect(await uniqueSlug.run(" taken-slug ", context({}, ["taken-slug"], post))).toBe(false);
		expect(await uniqueSlug.run("fresh-slug", context({}, ["taken-slug"], post))).toBe(true);
		// Without a known collection it does not query and lets the value pass.
		expect(await uniqueSlug.run("taken-slug", context({}, ["taken-slug"]))).toBe(true);
	});

	it("no-duplicate passes the collection, language and edited entry to the lookup", async () => {
		const slugsInUse = vi.fn(async () => new Set<string>());
		await uniqueSlug.run("a", {
			input: {},
			collection: "post",
			locale: "en",
			entryId: "e1",
			content: { slugsInUse },
			site: testSite,
		});
		expect(slugsInUse).toHaveBeenCalledWith({ collection: "post", locale: "en", slugs: ["a"], excludeEntryId: "e1" });
	});

	it("regex run keeps only valid patterns that match at least once in the code input, and attaches the match count", async () => {
		const code = "import { a, b, c } from 'x';\nconst value = 1;\nconst other = 2;";
		const check = regexRuns("code");
		expect(await check.run("const \\w+", context({ code }))).toEqual({
			detail: validatorText("regexRuns.detail", { count: 2 }),
		});
		expect(await check.run("(", context({ code }))).toBe(false);
		expect(await check.run("nothing-here", context({ code }))).toBe(false);
		// Still matches on the same input even if the rule name changes.
		expect(await regexRuns("code", { name: "strong" }).run("const \\w+", context({ code }))).toEqual({
			detail: validatorText("regexRuns.detail", { count: 2 }),
		});
	});

	it("structure-preserving returns a reason when the skeleton differs from the source input", async () => {
		const check = sameStructure("block");
		expect(await check.run("Hello [link](/a)", context({ block: "안녕 [링크](/a)" }))).toBe(true);
		expect(await check.run("Hello", context({ block: "안녕 [링크](/a)" }))).toEqual(expect.any(String));
	});
});
