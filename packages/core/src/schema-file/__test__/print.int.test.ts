import { describe, expect, it } from "vitest";
import { blogSchema } from "../../../test/blog-schema";
import { importSchemaText } from "../../../test/import-schema-text";
import { parseSchemaFile } from "../format";
import { parseSchemaLiteral } from "../literal";
import { printSchemaFile } from "../print";

describe("printSchemaFile", () => {
	it("SCHEMA-F13 prints the data so that importing the file gives the same data back", async () => {
		const text = printSchemaFile(blogSchema);
		expect(await importSchemaText(text)).toEqual(blogSchema);
		// The file is valid schema content, not only equal data.
		expect(() => parseSchemaFile(blogSchema)).not.toThrow();
	});

	it("SCHEMA-F13 round-trips awkward values: quotes, escapes, odd keys, unicode, numbers, null and empty containers", async () => {
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
});
