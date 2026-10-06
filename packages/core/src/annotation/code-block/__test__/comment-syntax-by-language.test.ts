import { describe, expect, it } from "vitest";
import { __testable__ as fromCodeFenceToCodeBlockDocumentTestable } from "../code-fence-to-document";
import { resolveCommentSyntax, resolveParseCommentSyntaxes } from "../comment-syntax";
import { __testable__ as fromCodeBlockDocumentToCodeFenceTestable } from "../document-to-code-fence";
import type { AnnotationConfig, CodeFence as Code } from "../types";

const { fromCodeFenceToCodeBlockDocument } = fromCodeFenceToCodeBlockDocumentTestable;
const { fromCodeBlockDocumentToCodeFence } = fromCodeBlockDocumentToCodeFenceTestable;

const annotationConfig: AnnotationConfig = {
	annotations: [
		{ name: "plus", kind: "class", class: "diff plus", scopes: ["line"] },
		{ name: "Tooltip", kind: "render", source: "mdx-text", render: "Tooltip", scopes: ["char", "document"] },
	],
};

const parse = (lang: string, value: string) => {
	const codeNode: Code = { type: "code", lang, meta: "", value };
	return fromCodeFenceToCodeBlockDocument(codeNode, annotationConfig);
};

const write = (document: ReturnType<typeof parse>) => fromCodeBlockDocumentToCodeFence(document, annotationConfig);

/** One representative language per comment syntax, with that syntax's prefix and postfix. */
const GROUPS = [
	{ lang: "python", prefix: "#", postfix: "" },
	{ lang: "sql", prefix: "--", postfix: "" },
	{ lang: "html", prefix: "<!--", postfix: " -->" },
	{ lang: "css", prefix: "/*", postfix: " */" },
	{ lang: "mdx", prefix: "{/*", postfix: " */}" },
	{ lang: "lisp", prefix: ";", postfix: "" },
	{ lang: "latex", prefix: "%", postfix: "" },
	{ lang: "mermaid", prefix: "%%", postfix: "" },
	{ lang: "ts", prefix: "//", postfix: "" },
];

const annotate = ({ prefix, postfix }: (typeof GROUPS)[number], body: string) => `${prefix} ${body}${postfix}`;

describe("comment syntax by language", () => {
	describe.each(GROUPS)("$lang ($prefix)", (group) => {
		const input = [
			annotate(group, "@line plus {0-0}"),
			"first",
			`  ${annotate(group, `@char Tooltip {0-4} content="tip"`)}`,
			"  second",
		].join("\n");

		it("parses its own syntax", () => {
			const document = parse(group.lang, input);

			expect(document.lines.map((line) => line.value)).toEqual(["first", "  second"]);
			expect(document.annotations).toEqual([
				expect.objectContaining({ scope: "line", name: "plus", range: { start: 0, end: 1 } }),
			]);
			expect(document.lines[1]?.annotations).toEqual([
				expect.objectContaining({
					scope: "char",
					name: "Tooltip",
					attributes: [{ name: "content", value: "tip" }],
				}),
			]);
		});

		it("writes its own syntax", () => {
			expect(write(parse(group.lang, input)).value).toBe(input);
		});

		it("round-trips parse, write, parse to an identical document", () => {
			const document = parse(group.lang, input);

			expect(parse(group.lang, write(document).value)).toEqual(document);
		});

		it("round-trips indented annotations with attributes", () => {
			const indented = [
				`\t${annotate(group, `@line plus {0-0} tone="info" dense`)}`,
				"\tbody",
				`\t${annotate(group, `@char Tooltip {1-3} content="a b"`)}`,
				"\tother",
			].join("\n");
			const document = parse(group.lang, indented);

			expect(document.lines.map((line) => line.value)).toEqual(["\tbody", "\tother"]);
			expect(document.annotations[0]?.attributes).toEqual([
				{ name: "tone", value: "info" },
				{ name: "dense", value: true },
			]);
			expect(write(document).value).toBe(indented);
			expect(parse(group.lang, write(document).value)).toEqual(document);
		});

		it("reads old `//` annotations and writes the language's own syntax", () => {
			const legacy = ["// @line plus {0-0}", "first", `  // @char Tooltip {0-4} content="tip"`, "  second"].join("\n");
			const document = parse(group.lang, legacy);

			expect(document).toEqual(parse(group.lang, input));
			expect(write(document).value).toBe(input);
		});
	});

	describe("aliases", () => {
		it.each([
			["py", "#"],
			["PY", "#"],
			["yml", "#"],
			["sh", "#"],
			["shell", "#"],
			["zsh", "#"],
			["fish", "#"],
			["dockerfile", "#"],
			["rb", "#"],
			["make", "#"],
			["env", "#"],
			["ps1", "#"],
			["gql", "#"],
			["conf", "#"],
			["hs", "--"],
			["md", "<!--"],
			["markdown", "<!--"],
			["mdx", "{/*"],
			["svg", "<!--"],
			["vue", "<!--"],
			["clj", ";"],
			["nasm", ";"],
			["tex", "%"],
			["erlang", "%"],
			["mermaid", "%%"],
			["postcss", "/*"],
			["scss", "//"],
			["less", "//"],
			["sass", "//"],
			["astro", "//"],
			["json5", "//"],
			["text", "//"],
			["tsx", "//"],
			["unknown-lang", "//"],
			[" Python ", "#"],
		])("%s resolves to %s", (lang, prefix) => {
			expect(resolveCommentSyntax(lang).prefix).toBe(prefix);
		});

		it("gives block comment languages their postfix", () => {
			expect(resolveCommentSyntax("css")).toEqual({ prefix: "/*", postfix: "*/" });
			expect(resolveCommentSyntax("md")).toEqual({ prefix: "<!--", postfix: "-->" });
			expect(resolveCommentSyntax("python").postfix).toBe("");
		});

		it("writes an alias with the syntax of its language", () => {
			const document = parse("yml", "# @line plus {0-0}\nkey: value");

			expect(document.lang).toBe("yml");
			expect(document.annotations).toHaveLength(1);
			expect(write(document).value).toBe("# @line plus {0-0}\nkey: value");
		});
	});

	describe("`//` fallback", () => {
		it("is tried after the language's own syntax and skipped for `//` languages", () => {
			expect(resolveParseCommentSyntaxes("python").map((syntax) => syntax.prefix)).toEqual(["#", "//"]);
			expect(resolveParseCommentSyntaxes("html").map((syntax) => syntax.prefix)).toEqual(["<!--", "//"]);
			expect(resolveParseCommentSyntaxes("ts").map((syntax) => syntax.prefix)).toEqual(["//"]);
		});

		it("does not consume a code line that merely contains `//`", () => {
			const value = ["echo http://x", "curl https://example.com/a // @line plus", "// plain comment", "ls"].join("\n");
			const document = parse("bash", value);

			expect(document.lines.map((line) => line.value)).toEqual(value.split("\n"));
			expect(document.annotations).toEqual([]);
		});

		it("does not consume `//` comments that are not a known scope or annotation", () => {
			const value = ["// @unknown plus", "// @line missing", "// @linebreak plus", "x"].join("\n");
			const document = parse("python", value);

			expect(document.lines.map((line) => line.value)).toEqual(value.split("\n"));
			expect(document.annotations).toEqual([]);
		});

		it("does not read another language's syntax", () => {
			const value = ["-- @line plus", "x"].join("\n");

			expect(parse("python", value).lines).toHaveLength(2);
			expect(parse("python", value).annotations).toEqual([]);
		});
	});

	describe("`%` and `%%`", () => {
		it("does not read a `%%` line in a `%` language or a `%` line in a `%%` language", () => {
			expect(parse("latex", "%% @line plus\nx").annotations).toEqual([]);
			expect(parse("mermaid", "% @line plus\nx").annotations).toEqual([]);
		});

		it("still reads each language's own syntax", () => {
			expect(parse("latex", "% @line plus\nx").annotations).toHaveLength(1);
			expect(parse("mermaid", "%% @line plus\nx").annotations).toHaveLength(1);
		});
	});
});
