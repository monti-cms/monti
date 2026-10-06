import { describe, expect, it } from "vitest";
import { __testable__ as fromCodeFenceToCodeBlockDocumentTestable } from "../code-fence-to-document";
import type { AnnotationConfig, CodeFence as Code } from "../types";

const { fromCodeFenceToCodeBlockDocument } = fromCodeFenceToCodeBlockDocumentTestable;
const annotationConfig: AnnotationConfig = {
	annotations: [{ name: "fold", kind: "render", source: "mdx-text", render: "fold", scopes: ["char", "document"] }],
};

const parse = (value: string) => {
	const codeNode: Code = {
		type: "code",
		lang: "tsx",
		meta: "",
		value,
	};

	return fromCodeFenceToCodeBlockDocument(codeNode, annotationConfig);
};

describe("regex annotation comment syntax", () => {
	it("@char fold regex applies only to the single code line right below", () => {
		const line = 'const value = "foo foo"';
		const nextLine = 'const tail = "foo"';
		const first = line.indexOf("foo");
		const second = line.indexOf("foo", first + 1);
		const document = parse(["// @char fold {re:/foo/g}", line, nextLine].join("\n"));

		expect(document.lines.map((item) => item.value)).toEqual([line, nextLine]);
		expect(document.lines[0]?.annotations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					scope: "char",
					name: "fold",
					render: "fold",
					range: { start: first, end: first + 3 },
				}),
				expect.objectContaining({
					scope: "char",
					name: "fold",
					render: "fold",
					range: { start: second, end: second + 3 },
				}),
			]),
		);
		expect(document.lines[1]?.annotations).toEqual([]);
	});

	it("@document fold regex finds across the whole code block and stores it as an absolute range", () => {
		const firstLine = 'const a = <div className="alpha beta" />';
		const secondLine = 'const b = <span className="gamma" />';
		const firstCapture = "alpha beta";
		const secondCapture = "gamma";
		const document = parse(
			['// @document fold {re:/(?<=className\\s*=\\s*")[^"]+(?=")/g}', firstLine, secondLine].join("\n"),
		);

		expect(document.lines.map((item) => item.value)).toEqual([firstLine, secondLine]);
		expect(document.lines[0]?.annotations).toEqual([
			expect.objectContaining({
				scope: "document",
				name: "fold",
				render: "fold",
				range: {
					start: firstLine.indexOf(firstCapture),
					end: firstLine.indexOf(firstCapture) + firstCapture.length,
				},
			}),
		]);

		const secondLineStart = firstLine.length + 1;
		expect(document.lines[1]?.annotations).toEqual([
			expect.objectContaining({
				scope: "document",
				name: "fold",
				render: "fold",
				range: {
					start: secondLineStart + secondLine.indexOf(secondCapture),
					end: secondLineStart + secondLine.indexOf(secondCapture) + secondCapture.length,
				},
			}),
		]);
	});

	it("does not create an annotation when the regex does not match", () => {
		const line = 'const value = "bar"';
		const document = parse(["// @char fold {re:/foo/g}", line].join("\n"));

		expect(document.lines.map((item) => item.value)).toEqual([line]);
		expect(document.lines[0]?.annotations).toEqual([]);
	});

	it("a document regex makes a range for every match even without the g flag", () => {
		const line = "foo bar foo";
		const document = parse(["// @document fold {re:/foo/}", line].join("\n"));

		expect(document.lines.map((item) => item.value)).toEqual([line]);
		expect(document.lines[0]?.annotations).toEqual([
			expect.objectContaining({
				scope: "document",
				name: "fold",
				range: { start: 0, end: 3 },
			}),
			expect.objectContaining({
				scope: "document",
				name: "fold",
				range: { start: 8, end: 11 },
			}),
		]);
	});

	it("a document regex match spanning a line break is split into per-line absolute ranges", () => {
		const firstLine = "hello";
		const secondLine = "world";
		const document = parse([String.raw`// @document fold {re:/o\nw/g}`, firstLine, secondLine].join("\n"));

		expect(document.lines.map((item) => item.value)).toEqual([firstLine, secondLine]);
		expect(document.lines[0]?.annotations).toEqual([
			expect.objectContaining({
				scope: "document",
				name: "fold",
				range: { start: 4, end: 5 },
			}),
		]);
		expect(document.lines[1]?.annotations).toEqual([
			expect.objectContaining({
				scope: "document",
				name: "fold",
				range: { start: 6, end: 7 },
			}),
		]);
	});
});

describe("regex rule preservation", () => {
	it("returns a regex selector as a rule, and attaches the rule index to the found ranges", () => {
		const document = parse(["// @document fold {re:/b+/}", "// @char fold {re:/a/g} open", "aab", "bb"].join("\n"));
		expect(document.rules).toEqual([
			{ scope: "document", name: "fold", pattern: "b+", flags: "", attributes: [] },
			{ scope: "char", name: "fold", pattern: "a", flags: "g", line: 0, attributes: [{ name: "open", value: true }] },
		]);
		expect(document.lines[0]?.annotations.map((annotation) => annotation.rule)).toEqual([1, 1, 0]);
	});

	it("also reads a `}` inside a regex as part of the selector", () => {
		const document = parse(["// @char fold {re:/a{2}[}]/}", "xaa}x"].join("\n"));
		expect(document.rules?.[0]).toMatchObject({ pattern: "a{2}[}]", line: 0 });
		expect(document.lines[0]?.annotations[0]?.range).toEqual({ start: 1, end: 4 });
	});

	it("drops @char rules with no line to apply to and re-links the remaining rule indexes", () => {
		const document = parse(["// @document fold {re:/x/}", "x", "// @char fold {re:/y/}"].join("\n"));
		expect(document.rules?.map((rule) => rule.scope)).toEqual(["document"]);
		expect(document.lines[0]?.annotations[0]?.rule).toBe(0);
	});

	it("writes a `/` in a regex as `\\/` so the comment does not break", async () => {
		const { __testable__ } = await import("../document-to-code-fence");
		const line = __testable__.fromRuleToCommentLine(
			{ prefix: "//", postfix: "" },
			{ scope: "document", name: "fold", pattern: "a/b\\/c", flags: "", attributes: [] },
		);
		expect(line).toBe("// @document fold {re:/a\\/b\\/c/}");
		expect(parse([line, "a/b/c"].join("\n")).lines[0]?.annotations[0]?.range).toEqual({ start: 0, end: 5 });
	});

	it("writes the rule as is when saved again", async () => {
		const { fromCodeBlockDocumentToCodeFence } = await import("../document-to-code-fence");
		const source = ["// @document fold {re:/b+/}", "// @char fold {re:/a/g} open", "aab", "bb"].join("\n");
		expect(fromCodeBlockDocumentToCodeFence(parse(source), annotationConfig).value).toBe(source);
	});
});
