import { describe, expect, it } from "vitest";
import { blogSchema } from "../../../test/blog-schema";
import { parseSchemaLiteral } from "../literal";
import { printSchemaFile } from "../print";

describe("printSchemaFile", () => {
	it("SCHEMA-F13 is deterministic: printing the data read back from the text gives the same text, and key order is kept", () => {
		const text = printSchemaFile(blogSchema);
		const literal = parseSchemaLiteral(text);
		if (!literal.ok) throw new Error(literal.message);
		expect(printSchemaFile(literal.value)).toBe(text);
		expect(Object.keys(literal.value)).toEqual(Object.keys(blogSchema));
		const reordered = { collections: blogSchema.collections, defaultLocale: "en" };
		expect(Object.keys((parseSchemaLiteral(printSchemaFile(reordered)) as { value: object }).value)).toEqual([
			"collections",
			"defaultLocale",
		]);
	});

	it("SCHEMA-F13 writes the one import and the one export, with tabs, trailing commas and unquoted keys", () => {
		const text = printSchemaFile({ defaultLocale: "en", collections: { post: { label: "Post", kind: "document" } } });
		expect(text).toBe(
			[
				'import { defineSchema } from "@monti-cms/core";',
				"",
				"export default defineSchema({",
				'\tdefaultLocale: "en",',
				"\tcollections: {",
				'\t\tpost: { label: "Post", kind: "document" },',
				"\t},",
				"});",
				"",
			].join("\n"),
		);
		expect(printSchemaFile({ "a-b": 1, c: undefined })).toContain('\t"a-b": 1,\n');
		expect(printSchemaFile({ "a-b": 1, c: undefined })).not.toContain("c:");
	});

	it("SCHEMA-F13 keeps long lists and objects on several lines, and short ones on one", () => {
		const long = Array.from({ length: 30 }, (_, index) => `option-number-${index}`);
		const text = printSchemaFile({ short: ["a", "b"], long, wide: { a: "x".repeat(90) } });
		expect(text).toContain('\tshort: ["a", "b"],\n');
		expect(text).toContain('\tlong: [\n\t\t"option-number-0",\n');
		expect(text).toContain('\twide: {\n\t\ta: "xxx');
	});

	it("SCHEMA-F13 refuses what a schema cannot hold", () => {
		expect(() => printSchemaFile({ a: Number.NaN })).toThrow(/cannot hold the number/);
		expect(() => printSchemaFile({ a: () => 1 })).toThrow(/cannot hold a function/);
		expect(() => printSchemaFile(JSON.parse('{"__proto__": {"x": 1}}'))).toThrow(/__proto__/);
	});
});
