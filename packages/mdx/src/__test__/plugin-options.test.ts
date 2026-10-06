import { describe, expect, it } from "vitest";
import { mdx, validateMdxOptions } from "../plugin";

/** The names of the syntax extensions are checked when the site config is created (`plugins: [mdx({ syntax })]`). */
describe("the options of the mdx plugin", () => {
	it("accepts syntax extensions", () => {
		const extension = { name: "notation" };
		expect(() => validateMdxOptions({ syntax: [extension] })).not.toThrow();
		expect(mdx({ syntax: [extension] }).options).toEqual({ syntax: [extension] });
	});

	it("accepts no options", () => {
		expect(() => validateMdxOptions(undefined)).not.toThrow();
		expect(() => mdx()).not.toThrow();
	});

	it("rejects duplicate extension names", () => {
		const extension = { name: "notation" };
		expect(() => validateMdxOptions({ syntax: [extension, extension] })).toThrow(/duplicate/);
		expect(() => mdx({ syntax: [extension, extension] })).toThrow(/duplicate/);
	});

	it("rejects an extension without a name", () => {
		expect(() => validateMdxOptions({ syntax: [{ name: "" }] })).toThrow(/needs a name/);
		expect(() => mdx({ syntax: [{ name: "" }] })).toThrow(/needs a name/);
	});
});
