import { mdxWith } from "@monti-cms/mdx/testing";
import { describe, expect, it } from "vitest";
import { hashOf } from "../../test/hash";
import { testSite } from "../../test/site";
import { directiveSyntax } from "..";

/**
 * With directive syntax on, a line break still has one meaning and one stored notation: every spelling (`:br[]` included) is read into the same document
 * node and the written body says `<br />`.
 */
const syntax = [directiveSyntax()];
const { analyze: read, toDocument, write, writeTwice } = mdxWith(testSite, syntax);

const hash = (source: string) => hashOf(testSite, { title: "t" }, source, syntax);

describe("directive syntax: line breaks", () => {
	it("FMT-S1 reads every spelling of a break into the same document", () => {
		const spellings = ["가:br[]나", "가<br />나", "가\\\n나", "가  \n나"];
		const documents = spellings.map((source) => toDocument(read(source)));
		for (const document of documents) expect(document).toEqual(documents[0]);
		expect(documents[0]?.content?.[0]?.content?.map((node) => node.type)).toEqual(["text", "hardBreak", "text"]);
	});

	it("FMT-S1 gives every spelling of a break the same content hash", () => {
		const spellings = ["가:br[]나", "가<br />나", "가\\\n나", "**가:br[]나**"];
		expect(new Set(spellings.slice(0, 3).map(hash)).size).toBe(1);
		expect(hash(spellings[3] ?? "")).toBe(hash("**가<br />나**"));
	});

	it("FMT-S1 writes <br /> and keeps the hash when a body is re-saved", () => {
		const source = "가:br[]나 :u[밑줄]";
		const written = write(source);
		expect(written).toContain("<br />");
		expect(written).not.toContain(":br");
		expect(hash(written)).toBe(hash(source));
	});

	describe("blank lines", () => {
		const blank = { type: "paragraph", content: [] };
		const kinds = (source: string) => toDocument(read(source)).content?.map((node) => node.type);

		it("FMT-S1 reads a line of only :br[] like a line of only <br />: one blank line", () => {
			expect(toDocument(read("앞\n\n:br[]\n\n뒤")).content?.[1]).toEqual(blank);
			expect(toDocument(read("앞\n\n<br />\n\n뒤"))).toEqual(toDocument(read("앞\n\n:br[]\n\n뒤")));
			expect(
				toDocument(read("앞\n\n:br[]:br[]\n\n뒤")).content?.filter((node) => node.type === "paragraph"),
			).toHaveLength(4);
		});

		it("FMT-S1 keeps blank lines between directive blocks and inside a container, written as <br />", () => {
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

		it("FMT-S1 does not write blank lines at the end of the body, in either notation", () => {
			expect(write("끝\n\n<br />\n\n:br[]\n")).toBe("끝\n");
		});
	});
});
