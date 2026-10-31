import { describe, expect, it } from "vitest";
import { blogSchema } from "../../../test/blog-schema";
import { parseSchemaLiteral } from "../literal";
import { printSchemaFile } from "../print";

const IMPORT = 'import { defineSchema } from "@monti-cms/core";';
const file = (body: string, before = "") => `${IMPORT}\n${before}\nexport default defineSchema(${body});\n`;
const refusal = (text: string) => {
	const result = parseSchemaLiteral(text);
	if (result.ok) throw new Error("the file was accepted");
	return result.message;
};

describe("parseSchemaLiteral: a file that is plain data", () => {
	it("SCHEMA-F13 accepts what the printer writes, with the same data and no comments", () => {
		const result = parseSchemaLiteral(printSchemaFile(blogSchema));
		expect(result).toMatchObject({ ok: true, comments: false });
		expect(result.ok && result.value).toEqual(blogSchema);
	});

	it("SCHEMA-F12 accepts a hand-formatted literal: comments, single quotes, trailing commas, odd spacing, quoted and numeric keys", () => {
		const text = `// The schema of my blog.
import { defineSchema } from '@monti-cms/core'

/* a block
   comment */
export default defineSchema(
	{
		"collections": {
			post: { label: 'Post', kind: "document", fields: { title: { kind: 'text', label: \`Title\`, max: 200, }, }, },
		},
		locales: [ { code: 'en', name: 'English' }, ],
		defaultLocale: 'en',
		3: 'three',
		site: { name: 'It\\'s "mine"\\n', ok: true, none: null, ratio: -1.5e2 },
	}
)
`;
		const result = parseSchemaLiteral(text);
		expect(result).toMatchObject({ ok: true, comments: true });
		expect(result.ok && result.value).toEqual({
			collections: {
				post: { label: "Post", kind: "document", fields: { title: { kind: "text", label: "Title", max: 200 } } },
			},
			locales: [{ code: "en", name: "English" }],
			defaultLocale: "en",
			3: "three",
			site: { name: 'It\'s "mine"\n', ok: true, none: null, ratio: -150 },
		});
	});

	it("SCHEMA-F12 tells comments from slashes inside strings", () => {
		const result = parseSchemaLiteral(file('{ url: "http://example.com/*x*/" }'));
		expect(result).toMatchObject({ ok: true, comments: false, value: { url: "http://example.com/*x*/" } });
	});
});

describe("parseSchemaLiteral: the escapes of a string", () => {
	it.each([
		["hex and unicode escapes", String.raw`"\x41\u0042\u{1F600}"`, "AB😀"],
		["the short escapes", String.raw`"a\tb\nc\\d\"e"`, 'a\tb\nc\\d"e'],
		["a line continuation", '"one \\\ntwo"', "one two"],
		["an escaped quote in single quotes", String.raw`'it\'s'`, "it's"],
	])("SCHEMA-F13 reads %s as the text they stand for", (_name, literal, value) => {
		expect(parseSchemaLiteral(file(`{ a: ${literal} }`))).toMatchObject({ ok: true, value: { a: value } });
	});

	it.each([
		["a hex escape with one digit", String.raw`"\x4"`],
		["a unicode escape with three digits", String.raw`"\u004"`],
		["a code point past the last one", String.raw`"\u{110000}"`],
		["a braced escape that is not closed", String.raw`"\u{41"`],
		["a unicode escape that is not hex", String.raw`"\uZZZZ"`],
	])("SCHEMA-F12 refuses %s", (_name, literal) => {
		expect(parseSchemaLiteral(file(`{ a: ${literal} }`))).toMatchObject({ ok: false, code: "escape_malformed" });
	});
});

describe("parseSchemaLiteral: a file that has code", () => {
	it.each([
		["a second import", file("{}", 'import { other } from "./other";'), /second import|line 2/],
		[
			"an import from another module",
			`import { defineSchema } from "somewhere-else";\nexport default defineSchema({});`,
			/module other than/,
		],
		["a variable before the export", file("{}", "const x = 1;"), /code before the schema|expected `export`/],
		["a spread in an object", file("{ ...base, defaultLocale: 1 }"), /spread/],
		["a spread in a list", file("{ locales: [...more] }"), /spread/],
		["a function call", file("{ site: { url: process.env.SITE_URL } }"), /property access on `process`/],
		["a call of a function", file("{ locales: build() }"), /function call `build\(\.\.\.\)`/],
		["an identifier", file("{ defaultLocale: locale }"), /identifier `locale`/],
		["undefined", file("{ timeZone: undefined }"), /identifier `undefined`/],
		["a computed key", file('{ ["a" + "b"]: 1 }'), /computed key/],
		["a shorthand property", file("{ defaultLocale }"), /shorthand property `defaultLocale`/],
		["a method", file("{ build() { return 1; } }"), /method or accessor/],
		// biome-ignore lint/suspicious/noTemplateCurlyInString: the text under test is a template literal
		["a template expression", file("{ label: `Hello ${name}` }"), /template expression/],
		["a binary expression", file("{ defaultLocale: 1 + 1 }"), /expected `,` or `}`/],
		["a cast", file("{ defaultLocale: 1 } as const"), /expected `\)`/],
		["code after the export", `${file("{}")}\nconsole.log("x");\n`, /code after the schema/],
		["a second export", `${file("{}")}\nexport const x = 1;\n`, /code after the schema/],
		["another export", `${IMPORT}\nexport const schema = defineSchema({});`, /expected `default`/],
		["a call of another function", `${IMPORT}\nexport default define({});`, /expected `defineSchema`/],
		["an array as the schema", file("[]"), /schema object/],
		["a duplicate key", file("{ a: 1, a: 2 }"), /written twice/],
		["the __proto__ key", file("{ __proto__: { a: 1 } }"), /__proto__/],
		["an unclosed string", file('{ a: "oops }'), /never closed/],
		["an unclosed comment", `${IMPORT}\n/* oops\nexport default defineSchema({});`, /comment that is never closed/],
		["an empty file", "", /expected `import/],
	])("SCHEMA-F12 refuses %s", (_name, text, expected) => {
		expect(refusal(text)).toMatch(expected);
	});

	it.each([
		["a second import", file("{}", 'import { other } from "./other";'), "second_import", {}],
		["a spread", file("{ ...base }"), "spread", {}],
		["a function call", file("{ locales: build() }"), "call", { name: "build" }],
		["a property access", file("{ site: { url: process.env.SITE_URL } }"), "access", { name: "process" }],
		["an identifier", file("{ defaultLocale: locale }"), "identifier", { name: "locale" }],
		["a duplicate key", file("{ a: 1, a: 2 }"), "duplicate_key", { name: "a" }],
		["code after the schema", `${file("{}")}\nconsole.log("x");\n`, "code_after", {}],
		["a missing comma", file("{ defaultLocale: 1 + 1 }"), "expected_token", { what: "`,` or `}`" }],
	])("SCHEMA-F12 gives %s a code and the names it mentions, for the screen to translate", (_name, text, code, params) => {
		expect(parseSchemaLiteral(text)).toMatchObject({ ok: false, code, params: expect.objectContaining(params) });
	});

	it("SCHEMA-F12 names the line the code is on", () => {
		const text = file("{\n\tdefaultLocale: 1,\n\tlocales: [...more],\n}");
		const result = parseSchemaLiteral(text);
		expect(result).toMatchObject({ ok: false, line: 5 });
		expect(refusal(text)).toMatch(/^line 5:/);
	});
});
