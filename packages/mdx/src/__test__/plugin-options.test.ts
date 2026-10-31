import { describe, expect, it } from "vitest";
import { checkMdxOptions, mdx } from "../plugin";

/** The names of the syntax extensions are checked with the site config (`plugins: [mdx({ syntax })]`). */
describe("the options of the mdx plugin", () => {
	it("FMT-P1 accepts syntax extensions", () => {
		const extension = { name: "notation" };
		expect(checkMdxOptions({ syntax: [extension] })).toEqual([]);
		expect(mdx({ syntax: [extension] }).options).toEqual({ syntax: [extension] });
	});

	it("FMT-P1 accepts no options", () => {
		expect(checkMdxOptions(undefined)).toEqual([]);
		expect(() => mdx()).not.toThrow();
	});

	it("FMT-P1 reports duplicate extension names", () => {
		const extension = { name: "notation" };
		expect(checkMdxOptions({ syntax: [extension, extension] })).toEqual([
			expect.objectContaining({ path: "plugins.mdx.options.syntax[1]", code: "duplicate" }),
		]);
	});

	it("FMT-P1 reports an extension without a name", () => {
		expect(checkMdxOptions({ syntax: [{ name: "" }] })).toEqual([
			expect.objectContaining({ path: "plugins.mdx.options.syntax[0]", code: "name" }),
		]);
	});
});
