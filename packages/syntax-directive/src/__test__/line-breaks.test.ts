import { insertSoftBreaks } from "@monti-cms/mdx/format";
import { describe, expect, it } from "vitest";
import { hashOf } from "../../test/hash";
import { mdxWith } from "../../test/mdx-syntax";
import { directiveSyntax } from "..";

/**
 * With directive syntax on, a line break still has one meaning and one stored notation: every spelling (`:br[]` included) is read into the same document
 * node and the written body says `<br />`.
 */
const syntax = [directiveSyntax()];
const { analyze: read, toDocument, write, writeTwice } = mdxWith(syntax);

const hash = (source: string) => hashOf({ title: "t" }, source, 1, syntax);

describe("directive syntax: line breaks", () => {
	it("reads every spelling of a break into the same document", () => {
		const spellings = ["가:br[]나", "가<br />나", "가\\\n나", "가  \n나"];
		const documents = spellings.map((source) => toDocument(read(source)));
		for (const document of documents) expect(document).toEqual(documents[0]);
		expect(documents[0]?.content?.[0]?.content?.map((node) => node.type)).toEqual(["text", "hardBreak", "text"]);
	});

	it("gives every spelling of a break the same content hash", () => {
		const spellings = ["가:br[]나", "가<br />나", "가\\\n나", "**가:br[]나**"];
		expect(new Set(spellings.slice(0, 3).map(hash)).size).toBe(1);
		expect(hash(spellings[3] ?? "")).toBe(hash("**가<br />나**"));
	});

	it("writes <br /> and keeps the hash when a body is re-saved", () => {
		const source = "가:br[]나 :u[밑줄]";
		const written = write(source);
		expect(written).toContain("<br />");
		expect(written).not.toContain(":br");
		expect(hash(written)).toBe(hash(source));
	});

	describe("blank lines", () => {
		const blank = { type: "paragraph", content: [] };
		const kinds = (source: string) => toDocument(read(source)).content?.map((node) => node.type);

		it("reads a line of only :br[] like a line of only <br />: one blank line", () => {
			expect(toDocument(read("앞\n\n:br[]\n\n뒤")).content?.[1]).toEqual(blank);
			expect(toDocument(read("앞\n\n<br />\n\n뒤"))).toEqual(toDocument(read("앞\n\n:br[]\n\n뒤")));
			expect(
				toDocument(read("앞\n\n:br[]:br[]\n\n뒤")).content?.filter((node) => node.type === "paragraph"),
			).toHaveLength(4);
		});

		it("keeps blank lines between directive blocks and inside a container, written as <br />", () => {
			const body = [
				"앞",
				"<br />",
				"<br />",
				':::text-align{align="center"}\n가운데\n\n<br />\n\n<br />\n\n끝\n:::',
				"<br />",
				'::image{mediaId="abc" alt="그림"}',
				"뒤",
			].join("\n\n");
			const written = `${body}\n`;
			expect(write(body)).toBe(written);
			expect(writeTwice(body)).toBe(written);
			expect(kinds(body)?.filter((type) => type === "paragraph")).toHaveLength(5);
			expect(hash(write(body))).toBe(hash(body));
		});

		it("does not write blank lines at the end of the body, in either notation", () => {
			expect(write("끝\n\n<br />\n\n:br[]\n")).toBe("끝\n");
		});
	});

	describe("soft line endings made explicit", () => {
		const migrate = (source: string): string => {
			const result = insertSoftBreaks(source, syntax);
			if (result.status !== "changed") throw new Error(`expected a change, got ${result.status}`);
			return result.mdx;
		};
		const BODY = [
			"# 제목",
			"",
			"첫 줄\n둘째 줄 :u[밑줄\n이어서] 와 :sup[2]",
			"",
			':::text-align{align="center"}',
			"가운데\n두 줄",
			":::",
			"",
			'::image{mediaId="abc" alt="설명"}',
			"",
			"```ts",
			"const a = 1;",
			"const b = 2;",
			"```",
			"",
			"| a | b |",
			"| - | - |",
			"| 1 | 2 |",
			"",
			"- 하나\n  이어서",
			"",
			"끝",
			"",
		].join("\n");

		it("changes nothing but the breaks: the directive text stays byte for byte", () => {
			const result = migrate(BODY);
			expect(result.replaceAll("<br />", "")).toBe(BODY);
			expect(result).toContain(':::text-align{align="center"}\n가운데<br />\n두 줄\n:::');
			expect(result).toContain('::image{mediaId="abc" alt="설명"}');
			expect(result).toContain("const a = 1;\nconst b = 2;");
		});

		it("reads as the same document as the body with explicit breaks written by hand", () => {
			const explicit = BODY.replace("첫 줄\n둘째 줄", "첫 줄<br />둘째 줄")
				.replace("밑줄\n이어서", "밑줄<br />이어서")
				.replace("가운데\n두 줄", "가운데<br />두 줄")
				.replace("하나\n  이어서", "하나<br />\n  이어서");
			expect(toDocument(read(migrate(BODY)))).toEqual(toDocument(read(explicit)));
		});

		it("is a no-op the second time and gives the same hash as the explicit body", () => {
			const once = migrate(BODY);
			expect(insertSoftBreaks(once, syntax)).toEqual({ status: "unchanged" });
			expect(hash(once)).toBe(hash(write(once)));
		});

		it("does not touch source an extension turned back into text (an unregistered directive)", () => {
			const source = ":::not-a-block\n여러\n줄\n:::\n\n본문\n둘째 줄";
			expect(migrate(source)).toBe(":::not-a-block\n여러\n줄\n:::\n\n본문<br />\n둘째 줄");
		});

		it("leaves the whole body as it is when a line ending cannot be paired with the source", () => {
			const source = ":not-a-block[여러\n줄] 본문\n둘째 줄";
			expect(insertSoftBreaks(source, syntax)).toMatchObject({ status: "skipped", reason: "unsafe" });
		});

		it("leaves a leaf directive's attributes alone", () => {
			const source = '::image{mediaId="abc" alt="여러\n줄 설명"}\n';
			expect(insertSoftBreaks(source, syntax).status).not.toBe("changed");
		});
	});
});
