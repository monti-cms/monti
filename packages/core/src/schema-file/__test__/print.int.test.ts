import { describe, expect, it } from "vitest";
import { blogSchema } from "../../../test/blog-schema";
import { importSchemaText } from "../../../test/import-schema-text";
import { parseSchemaFile } from "../format";
import { parseSchemaLiteral } from "../literal";
import { printSchemaFile } from "../print";

describe("printSchemaFile", () => {
	it("prints the data so that importing the file gives the same data back", async () => {
		const text = printSchemaFile(blogSchema);
		expect(await importSchemaText(text)).toEqual(blogSchema);
		// The file is valid schema content, not only equal data.
		expect(() => parseSchemaFile(blogSchema)).not.toThrow();
	});

	it("round-trips awkward values: quotes, escapes, odd keys, unicode, numbers, null and empty containers", async () => {
		const data = {
			// biome-ignore lint/suspicious/noTemplateCurlyInString: the text holds a literal ${...} on purpose
			note: 'He said "hi"\nthen\tleft \\   \u{1f600} `tick` ${not}',
			"needs-quotes": { "1st": 1, ok_key: -0.5, $dollar: 1e21, empty: {}, none: [], nothing: null },
			list: [1, "two", true, null, ["nested", ["deep"]], { a: 1 }],
			default: { class: "reserved words are valid keys" },
		};
		const text = printSchemaFile(data);
		expect(await importSchemaText(text)).toEqual(data);
		const literal = parseSchemaLiteral(text);
		expect(literal.ok && literal.value).toEqual(data);
	});

	it("is deterministic: printing the data read back from the text gives the same text, and key order is kept", () => {
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

	it("writes the one import and the one export, with tabs, trailing commas and unquoted keys", () => {
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

	it("keeps long lists and objects on several lines, and short ones on one", () => {
		const long = Array.from({ length: 30 }, (_, index) => `option-number-${index}`);
		const text = printSchemaFile({ short: ["a", "b"], long, wide: { a: "x".repeat(90) } });
		expect(text).toContain('\tshort: ["a", "b"],\n');
		expect(text).toContain('\tlong: [\n\t\t"option-number-0",\n');
		expect(text).toContain('\twide: {\n\t\ta: "xxx');
	});

	it("refuses what a schema cannot hold", () => {
		expect(() => printSchemaFile({ a: Number.NaN })).toThrow(/cannot hold the number/);
		expect(() => printSchemaFile({ a: () => 1 })).toThrow(/cannot hold a function/);
		expect(() => printSchemaFile(JSON.parse('{"__proto__": {"x": 1}}'))).toThrow(/__proto__/);
	});
});
