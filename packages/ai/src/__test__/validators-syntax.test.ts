import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiValidatorContext } from "../action";
import { sameStructure } from "../validators";

/**
 * The structure check reads both texts with the syntax extensions of the site config (`mdx({ syntax })`), so a text written in an extension's notation
 * is compared as the document it means. The site config of these tests lists no `mdx` plugin, so the configured syntax is stood in for.
 */
const CONFIGURED = [{ name: "fake-notation" }];

const compareMdxStructure = vi.hoisted(() => vi.fn());

vi.mock("@monti-cms/mdx/format", async (importOriginal) => ({
	...(await importOriginal<typeof import("@monti-cms/mdx/format")>()),
	configuredSyntax: () => CONFIGURED,
	compareMdxStructure,
}));

const context = (input: Record<string, unknown>): AiValidatorContext => ({
	input,
	locale: "ko",
	content: { slugsInUse: async () => new Set() },
});

describe("same-structure check with the configured syntax", () => {
	beforeEach(() => compareMdxStructure.mockReset());

	it("compares the source and the model's text with the syntax of the site config", async () => {
		compareMdxStructure.mockReturnValue({ ok: true });
		const result = await sameStructure("body").run("## B", context({ body: "## A" }));
		expect(result).toBe(true);
		expect(compareMdxStructure).toHaveBeenCalledWith("## A", "## B", CONFIGURED);
	});

	it("gives back the reason of the comparison when the structure differs", async () => {
		compareMdxStructure.mockReturnValue({ ok: false, reason: "a link is missing" });
		expect(await sameStructure("body").run("B", context({ body: "[A](/a)" }))).toBe("a link is missing");
	});
});
