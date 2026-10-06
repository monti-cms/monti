import { describe, expect, it } from "vitest";
import type { StoredDocument } from "../../mdx/stored-document";
import type { CmsNode } from "../../mdx/types";
import { checkDocument, isEmptyDocument } from "../body-check";

/** Checks that need the reference blog's addresses and blocks (`/posts/:slug`, `code-ref`). */
const doc = (...content: CmsNode[]): StoredDocument => ({ type: "doc", version: 2, content });
const paragraph = (id: string, ...content: CmsNode[]): CmsNode => ({ id, type: "paragraph", content });
const text = (value: string, ...marks: CmsNode["marks"] & object): CmsNode => ({
	type: "text",
	text: value,
	...(marks.length > 0 ? { marks } : {}),
});

describe("checks of a stored document (reference blog config)", () => {
	it("counts a stretch of text that other marks split into several text nodes once", () => {
		const link = { type: "link", attrs: { href: "/posts/a" } };
		const result = checkDocument(
			doc(
				paragraph(
					"aaaaaaaa",
					text("a ", link),
					text("b", link, { type: "bold" }),
					text(" c", link),
					text(" apart "),
					text("again", link),
				),
			),
		);
		// The stretch is one link; the same address after plain text is another.
		expect(result.internalLinks.map((item) => item.slug)).toEqual(["a", "a"]);
		expect(result.internalLinks.every((item) => item.position.blockId === "aaaaaaaa")).toBe(true);
	});

	it("reads the labels and links of code from the stored annotations and the text marks of the block definitions", () => {
		const code: CmsNode = {
			id: "bbbbbbbb",
			type: "codeBlock",
			attrs: {
				language: "ts",
				code: "a();",
				annotations: { lines: [{ name: "anchor", start: 0, end: 1, attrs: { id: "c1" } }] },
			},
		};
		const withRef = (to: string) =>
			checkDocument(doc(paragraph("aaaaaaaa", text("see", { type: "code-ref", attrs: { to } })), code));
		expect(withRef("c1").issues.map((issue) => issue.code)).toEqual([]);
		const broken = withRef("c2");
		expect(broken.issues).toEqual([
			expect.objectContaining({ code: "code_ref_broken", position: { blockId: "aaaaaaaa" } }),
		]);
	});
});
