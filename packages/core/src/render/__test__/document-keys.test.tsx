import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../test/site";
import { STORED_DOCUMENT_VERSION, type StoredDocument } from "../../doc/stored-document";
import type { CmsNode } from "../../doc/types";
import { renderDocument } from "../index";

const text = (value: string, marks?: CmsNode["marks"]): CmsNode => ({
	type: "text",
	text: value,
	...(marks ? { marks } : {}),
});
const p = (...content: CmsNode[]): CmsNode => ({ type: "paragraph", content });

/** A body shaped like the showcase: marks, links, breaks, task lists, tables, footnotes, code, quotes and images. */
const showcase: StoredDocument = {
	type: "doc",
	version: STORED_DOCUMENT_VERSION,
	content: [
		{ type: "heading", attrs: { level: 2 }, content: [text("Title"), text(" bold", [{ type: "bold" }])] },
		p(
			text("plain "),
			text("bold", [{ type: "bold" }]),
			text(" and "),
			text("both", [{ type: "bold" }, { type: "italic" }]),
			{ type: "hardBreak" },
			text("link", [{ type: "link", attrs: { href: "https://example.com" } }]),
			{ type: "footnoteReference", attrs: { label: "1" } },
			{ type: "image", attrs: { alt: "inline", src: "https://example.com/a.png" } },
		),
		{ type: "bulletList", content: [{ type: "listItem", content: [p(text("one"), text("!", [{ type: "code" }]))] }] },
		{
			type: "bulletList",
			content: [
				{ type: "listItem", attrs: { checked: true }, content: [p(text("done"), text("x", [{ type: "bold" }]))] },
			],
		},
		{
			type: "bulletList",
			content: [
				{
					type: "listItem",
					attrs: { checked: false },
					content: [p(text("loose "), text("a", [{ type: "bold" }])), p(text("second"))],
				},
			],
		},
		{ type: "paragraph" },
		{ type: "blockquote", content: [p(text("quote"), text("em", [{ type: "italic" }]))] },
		{
			type: "table",
			content: [
				{
					type: "tableRow",
					content: [
						{ type: "tableCell", content: [p(text("a"))] },
						{ type: "tableCell", content: [p(text("b"))] },
					],
				},
			],
		},
		{ type: "codeBlock", attrs: { language: "ts", meta: "", code: "const a = 1;" } },
		{ type: "footnoteDefinition", attrs: { label: "1" }, content: [p(text("note"), text("b", [{ type: "bold" }]))] },
	],
};

afterEach(() => vi.restoreAllMocks());

describe("keys of rendered children", () => {
	it("renders every child list with keys, so React logs no key warning", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { content } = await renderDocument(showcase, { site: testSite });
		renderToStaticMarkup(content);
		const warned = error.mock.calls.filter((call) => String(call[0]).includes('unique "key"'));
		expect(warned).toEqual([]);
	});
});
