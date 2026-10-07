import { describe, expect, it } from "vitest";
import { testSite } from "../../../../test/site";
import { docOf } from "../../../../test/stored-content";
import { forEachBlock } from "../../../doc/block-ids";
import { unparsedDocument } from "../../../doc/stored-document";
import type { CmsNode } from "../../../doc/types";
import { documentText, EXCERPT_TEXT, SEARCH_TEXT } from "../../body-text";
import { withTranslationHints } from "../hints";
import { compareStructure } from "../skeleton";

const texts = (nodes: readonly CmsNode[]): CmsNode[] =>
	nodes.flatMap((node) => (node.text === undefined ? texts(node.content ?? []) : [node]));

describe("translation hints", () => {
	const source = docOf("# 제목\n\n**굵은** 문장과 `code` 입니다.\n\n```ts\nconst a = 1;\n```\n");

	it("marks every text of the source as untranslated and nothing else", () => {
		const hinted = withTranslationHints(testSite, source);
		const marked = texts(hinted.content).filter((node) => node.text?.trim());
		expect(marked.length).toBeGreaterThan(0);
		for (const node of marked) expect(node.marks?.map((mark) => mark.type)).toContain("untranslated");
		// Code and diagrams are values of their block, not text, so they are copied as they are.
		expect(hinted.content.at(-1)).toMatchObject({ type: "codeBlock", attrs: { code: "const a = 1;" } });
	});

	it("keeps the structure of the source: only the notes make it differ, and it passes once they are gone", () => {
		const hinted = withTranslationHints(testSite, source);
		expect(compareStructure(testSite, source, hinted).ok).toBe(false);
		const strip = (nodes: readonly CmsNode[]): CmsNode[] =>
			nodes.map((node) => {
				const { marks, ...rest } = node;
				const kept = marks?.filter((mark) => mark.type !== "untranslated");
				return {
					...rest,
					...(kept && kept.length > 0 ? { marks: kept } : {}),
					...(node.content ? { content: strip(node.content) } : {}),
				};
			});
		expect(compareStructure(testSite, source, { ...hinted, content: strip(hinted.content) })).toEqual({ ok: true });
	});

	it("hides the notes from the excerpt and keeps them for search", () => {
		const hinted = withTranslationHints(testSite, source);
		expect(documentText(testSite, hinted, EXCERPT_TEXT)).toBe("");
		expect(documentText(testSite, hinted, SEARCH_TEXT)).toContain("제목");
	});

	it("gives the translation blocks of its own: no block ids", () => {
		const hinted = withTranslationHints(testSite, source);
		let ids = 0;
		forEachBlock(hinted.content, (block) => {
			if (block.id !== undefined) ids += 1;
		});
		expect(ids).toBe(0);
		let sourceIds = 0;
		forEachBlock(source.content, (block) => {
			if (block.id !== undefined) sourceIds += 1;
		});
		expect(sourceIds).toBeGreaterThan(0);
	});

	it("does not change the document it is given", () => {
		const before = JSON.stringify(source);
		withTranslationHints(testSite, source);
		expect(JSON.stringify(source)).toBe(before);
	});

	it("returns a source that is not a document as it is, without ids", () => {
		const unparsed = unparsedDocument("열리지 않은 <Box");
		const hinted = withTranslationHints(testSite, unparsed);
		expect(hinted.content).toEqual([{ attrs: { format: "mdx", source: "열리지 않은 <Box" }, type: "unparsed" }]);
	});
});
