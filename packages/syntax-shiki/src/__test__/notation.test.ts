import { describe, expect, it } from "vitest";
import { convertShikiNotation, type NotationSettings, readableCommentSyntaxes } from "../notation";

/** Converting the value of a code fence: Shiki notation in, Monti annotation comments out. */

const DEFAULT_EFFECTS = ["highlight", "plus", "minus", "warning", "error"];
const settings = (overrides: Partial<NotationSettings> & { effects?: string[] } = {}): NotationSettings => ({
	word: "strong",
	lineEffects: new Set(overrides.effects ?? DEFAULT_EFFECTS),
	...(overrides.word !== undefined ? { word: overrides.word } : {}),
});
const convert = (value: string, lang = "ts", options: Parameters<typeof settings>[0] = {}) =>
	convertShikiNotation(value, lang, settings(options));
const lines = (...rows: string[]) => rows.join("\n");

describe("trailing comments", () => {
	it.each([
		["// [!code ++]", "plus"],
		["// [!code --]", "minus"],
		["// [!code highlight]", "highlight"],
		["// [!code hl]", "highlight"],
		["// [!code error]", "error"],
		["// [!code warning]", "warning"],
	])("%s becomes a %s line annotation above the line", (notation, effect) => {
		expect(convert(lines("const a = 1", `const b = 2 ${notation}`, "const c = 3"))).toBe(
			lines("const a = 1", `// @line ${effect}`, "const b = 2", "const c = 3"),
		);
	});

	it("keeps the indentation of the line", () => {
		expect(convert(lines("function f() {", "\treturn 1 // [!code ++]", "}"))).toBe(
			lines("function f() {", "\t// @line plus", "\treturn 1", "}"),
		);
		expect(convert("if (a) {\n    b() // [!code --]\n}")).toBe("if (a) {\n    // @line minus\n    b()\n}");
	});

	it("reads the notation case-insensitively and with the usual spacing", () => {
		expect(convert("a //[!code HL]")).toBe(lines("// @line highlight", "a"));
		expect(convert("a    //   [!code ++]  ")).toBe(lines("// @line plus", "a"));
	});

	it("keeps the rest of a comment that has other text", () => {
		expect(convert("a() // call it [!code ++]")).toBe(lines("// @line plus", "a() // call it"));
	});

	it("reads several notations in one comment", () => {
		expect(convert("a // [!code ++] [!code highlight]")).toBe(lines("// @line plus", "// @line highlight", "a"));
	});

	it("handles consecutive lines, each with its own notation", () => {
		expect(convert(lines("a // [!code --]", "b // [!code ++]", "c // [!code ++]", "d"))).toBe(
			lines("// @line minus", "a", "// @line plus", "b", "// @line plus", "c", "d"),
		);
	});
});

describe("whole-line comments", () => {
	it("removes the line and applies to the next code line", () => {
		expect(convert(lines("a", "// [!code ++]", "b", "c"))).toBe(lines("a", "// @line plus", "b", "c"));
	});

	it("takes the indentation of the line it applies to", () => {
		expect(convert(lines("if (a) {", "\t// [!code highlight]", "\tb()", "}"))).toBe(
			lines("if (a) {", "\t// @line highlight", "\tb()", "}"),
		);
	});

	it("stacks on the next code line", () => {
		expect(convert(lines("// [!code ++]", "// [!code highlight]", "a", "b"))).toBe(
			lines("// @line plus", "// @line highlight", "a", "b"),
		);
	});

	it("is dropped when no code line follows", () => {
		expect(convert(lines("a", "// [!code ++]"))).toBe("a");
	});

	it("keeps a comment that has other text and applies to the next line", () => {
		expect(convert(lines("// the new call [!code ++]", "a()"))).toBe(lines("// the new call", "// @line plus", "a()"));
	});
});

describe("counts", () => {
	it("a trailing count covers this line and the next ones, as a closed range", () => {
		expect(convert(lines("a", "b // [!code ++:3]", "c", "d", "e"))).toBe(
			lines("a", "// @line plus {1-3}", "b", "c", "d", "e"),
		);
	});

	it("a whole-line count covers the next lines", () => {
		expect(convert(lines("a", "// [!code highlight:2]", "b", "c", "d"))).toBe(
			lines("a", "// @line highlight {1-2}", "b", "c", "d"),
		);
	});

	it("counts code lines only: removed notation lines and existing Monti annotations are not counted", () => {
		expect(convert(lines("// [!code ++]", "a", "// [!code error]", "b", "c // [!code highlight:2]", "d"))).toBe(
			lines("// @line plus", "a", "// @line error", "b", "// @line highlight {2-3}", "c", "d"),
		);
		expect(convert(lines("// @line warning", "a", "b // [!code ++:2]", "c"))).toBe(
			lines("// @line warning", "a", "// @line plus {1-2}", "b", "c"),
		);
	});

	it("is clipped to the end of the code", () => {
		expect(convert(lines("a", "b // [!code ++:9]", "c"))).toBe(lines("a", "// @line plus {1-2}", "b", "c"));
		expect(convert(lines("a", "b // [!code ++:9]"))).toBe(lines("a", "// @line plus", "b"));
	});

	it("a count of 1 is a single line and a count of 0 only removes the notation", () => {
		expect(convert("a // [!code ++:1]")).toBe(lines("// @line plus", "a"));
		expect(convert("a // [!code ++:0]")).toBe("a");
	});
});

describe("focus and info", () => {
	it("focus becomes highlight when the site has no focus effect", () => {
		expect(convert("a // [!code focus]")).toBe(lines("// @line highlight", "a"));
	});

	it("focus becomes the site's focus effect when it has one", () => {
		expect(convert("a // [!code focus]", "ts", { effects: [...DEFAULT_EFFECTS, "focus"] })).toBe(
			lines("// @line focus", "a"),
		);
	});

	it("info is converted only when the site has an info effect", () => {
		expect(convert("a // [!code info]")).toBe("a // [!code info]");
		expect(convert("a // [!code info]", "ts", { effects: [...DEFAULT_EFFECTS, "info"] })).toBe(
			lines("// @line info", "a"),
		);
	});
});

describe("word", () => {
	it("becomes a regex text rule on the line", () => {
		expect(convert("const message = 'Hello' // [!code word:Hello:1]")).toBe(
			lines("// @char strong {re:/Hello/g}", "const message = 'Hello'"),
		);
	});

	it("without a count on the first line covers the whole code", () => {
		expect(convert(lines("// [!code word:Hello]", "a Hello", "b Hello"))).toBe(
			lines("// @document strong {re:/Hello/g}", "a Hello", "b Hello"),
		);
	});

	it("without a count further down covers the lines up to the end", () => {
		expect(convert(lines("a", "b // [!code word:x]", "c", "d"))).toBe(
			lines("a", "// @char strong {re:/x/g}", "b", "// @char strong {re:/x/g}", "c", "// @char strong {re:/x/g}", "d"),
		);
	});

	it("with a count covers that many lines", () => {
		expect(convert(lines("// [!code word:x:2]", "a", "b", "c"))).toBe(
			lines("// @char strong {re:/x/g}", "a", "// @char strong {re:/x/g}", "b", "c"),
		);
	});

	it("escapes regex characters, slashes and backslash escapes in the word", () => {
		expect(convert("a // [!code word:a.b(c)/d:1]")).toBe(lines("// @char strong {re:/a\\.b\\(c\\)\\/d/g}", "a"));
		expect(convert("a // [!code word:a\\:b:1]")).toBe(lines("// @char strong {re:/a:b/g}", "a"));
	});

	it("uses the configured effect, or is left alone when off", () => {
		expect(convert("a // [!code word:x:1]", "ts", { word: "u" })).toBe(lines("// @char u {re:/x/g}", "a"));
		expect(convert("a // [!code word:x:1]", "ts", { word: false })).toBe("a // [!code word:x:1]");
	});
});

describe("comment syntax of the language", () => {
	it("reads # comments in python and bash and writes Monti's # annotations", () => {
		expect(convert(lines("x = 1", "y = 2  # [!code ++]"), "python")).toBe(lines("x = 1", "# @line plus", "y = 2"));
		expect(convert(lines("# [!code --]", "rm a"), "bash")).toBe(lines("# @line minus", "rm a"));
		expect(convert("echo hi # [!code hl]", "sh")).toBe(lines("// @line highlight", "echo hi"));
	});

	it("reads <!-- --> comments in html and writes Monti's annotation comment", () => {
		expect(convert(lines("<div>", "  <p>a</p> <!-- [!code ++] -->", "</div>"), "html")).toBe(
			lines("<div>", "  // @line plus", "  <p>a</p>", "</div>"),
		);
		expect(convert(lines("<!-- [!code highlight:2] -->", "<a>", "<b>"), "html")).toBe(
			lines("// @line highlight {0-1}", "<a>", "<b>"),
		);
	});

	it("reads block comments in a // language", () => {
		expect(convert("a(); /* [!code ++] */")).toBe(lines("// @line plus", "a();"));
		expect(convert("a(); /* note */ // [!code ++]")).toBe(lines("// @line plus", "a(); /* note */"));
		expect(convert("a(); // note /* [!code ++] */")).toBe(lines("// @line plus", "a(); // note"));
	});

	it("reads -- comments in sql", () => {
		expect(convert("select 1 -- [!code ++]", "sql")).toBe(lines("-- @line plus", "select 1"));
	});

	it("does not read a comment form the language does not have", () => {
		expect(convert("x = 1 # [!code ++]", "ts")).toBe("x = 1 # [!code ++]");
		expect(convert("x = 1 // [!code ++]", "python")).toBe("x = 1 // [!code ++]");
		expect(convert("x = 1 <!-- [!code ++] -->", "ts")).toBe("x = 1 <!-- [!code ++] -->");
	});

	it("falls back to // for an unknown language and for none", () => {
		expect(convert("a // [!code ++]", "unknown-lang")).toBe(lines("// @line plus", "a"));
		expect(convertShikiNotation("a // [!code ++]", null, settings())).toBe(lines("// @line plus", "a"));
	});

	it("lists the comment forms of a language", () => {
		expect(readableCommentSyntaxes("python")).toEqual([{ prefix: "#", postfix: "" }]);
		expect(readableCommentSyntaxes("ts")).toEqual([
			{ prefix: "//", postfix: "" },
			{ prefix: "/*", postfix: "*/" },
		]);
	});
});

describe("left alone", () => {
	it.each([
		["code without notation", "const a = 1\n// plain comment\nb()"],
		["an unknown notation", "a // [!code nope]\nb // [!code ++x]"],
		["a notation that is not in a comment", "const a = [!code ++]"],
		["a notation in a string", 'const a = "// [!code ++]"'],
		["a notation in a string before a real comment", "const a = '[!code ++]' // plain"],
		["a url and a string with a slash pair", 'fetch("http://x/[!code ++]")'],
		["a notation in the middle of a line", "a /* [!code ++] */ b"],
	])("%s", (_name, value) => {
		expect(convert(value)).toBe(value);
	});

	it("only converts the real comment when a string holds the notation too", () => {
		expect(convert(`const a = "// [!code --]" // [!code ++]`)).toBe(
			lines("// @line plus", `const a = "// [!code --]"`),
		);
	});

	it("keeps an unknown notation next to a known one", () => {
		expect(convert("a // [!code ++] [!code nope]")).toBe(lines("// @line plus", "a // [!code nope]"));
	});

	it("keeps existing Monti annotations as they are", () => {
		const value = lines("// @line plus {0-0}", "a", "// @char strong {re:/a/g}", "b");
		expect(convert(value)).toBe(value);
	});
});
