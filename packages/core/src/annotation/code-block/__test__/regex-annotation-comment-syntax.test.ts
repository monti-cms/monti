import type { Code } from "mdast";
import { describe, expect, it } from "vitest";
import { __testable__ as fromCodeFenceToCodeBlockDocumentTestable } from "../code-fence-to-document";
import type { AnnotationConfig } from "../types";

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
	it("@char fold regex는 바로 아래 코드 한 줄에만 적용한다", () => {
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

	it("@document fold regex는 코드블록 전체에서 찾고 absolute range로 저장한다", () => {
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

	it("regex가 매치되지 않으면 annotation을 만들지 않는다", () => {
		const line = 'const value = "bar"';
		const document = parse(["// @char fold {re:/foo/g}", line].join("\n"));

		expect(document.lines.map((item) => item.value)).toEqual([line]);
		expect(document.lines[0]?.annotations).toEqual([]);
	});

	it("g 플래그가 없어도 document regex는 모든 매치를 range로 만든다", () => {
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

	it("줄바꿈을 가로지르는 document regex 매치는 라인별 absolute range로 분할된다", () => {
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

describe("정규식 규칙 보존", () => {
	it("정규식 선택자를 규칙으로 돌려주고, 찾은 범위에 규칙 번호를 단다", () => {
		const document = parse(["// @document fold {re:/b+/}", "// @char fold {re:/a/g} open", "aab", "bb"].join("\n"));
		expect(document.rules).toEqual([
			{ scope: "document", name: "fold", pattern: "b+", flags: "", attributes: [] },
			{ scope: "char", name: "fold", pattern: "a", flags: "g", line: 0, attributes: [{ name: "open", value: true }] },
		]);
		expect(document.lines[0]?.annotations.map((annotation) => annotation.rule)).toEqual([1, 1, 0]);
	});

	it("정규식 안의 `}`도 선택자로 읽는다", () => {
		const document = parse(["// @char fold {re:/a{2}[}]/}", "xaa}x"].join("\n"));
		expect(document.rules?.[0]).toMatchObject({ pattern: "a{2}[}]", line: 0 });
		expect(document.lines[0]?.annotations[0]?.range).toEqual({ start: 1, end: 4 });
	});

	it("적용할 줄이 없는 @char 규칙은 버리고 나머지 규칙 번호를 다시 잇는다", () => {
		const document = parse(["// @document fold {re:/x/}", "x", "// @char fold {re:/y/}"].join("\n"));
		expect(document.rules?.map((rule) => rule.scope)).toEqual(["document"]);
		expect(document.lines[0]?.annotations[0]?.rule).toBe(0);
	});

	it("정규식의 `/`는 주석이 깨지지 않게 `\\/`로 쓴다", async () => {
		const { __testable__ } = await import("../document-to-code-fence");
		const line = __testable__.fromRuleToCommentLine(
			{ prefix: "//", postfix: "" },
			{ scope: "document", name: "fold", pattern: "a/b\\/c", flags: "", attributes: [] },
		);
		expect(line).toBe("// @document fold {re:/a\\/b\\/c/}");
		expect(parse([line, "a/b/c"].join("\n")).lines[0]?.annotations[0]?.range).toEqual({ start: 0, end: 5 });
	});

	it("다시 저장하면 규칙 그대로 쓴다", async () => {
		const { fromCodeBlockDocumentToCodeFence } = await import("../document-to-code-fence");
		const source = ["// @document fold {re:/b+/}", "// @char fold {re:/a/g} open", "aab", "bb"].join("\n");
		expect(fromCodeBlockDocumentToCodeFence(parse(source), annotationConfig).value).toBe(source);
	});
});
