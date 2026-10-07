import { describe, expect, it } from "vitest";
import { contentCollection } from "../../../test/any-site";
import { testSite } from "../../../test/site";
import { docOf } from "../../../test/stored-content";
import type { StoredDocument } from "../../doc/stored-document";
import type { CmsNode } from "../../doc/types";
import { paragraphsFormat } from "../../format/__test__/paragraphs-format";
import { createFormatRegistry } from "../../format/registry";
import { checkDocument, isEmptyDocument } from "../body-check";
import { prepareSnapshot } from "../snapshot";

/** The checks of a stored document, on documents given directly (the cases a text cannot spell). */
const doc = (...content: CmsNode[]): StoredDocument => ({ type: "doc", version: 2, content });
const paragraph = (id: string, ...content: CmsNode[]): CmsNode => ({ id, type: "paragraph", content });
const text = (value: string, ...marks: CmsNode["marks"] & object): CmsNode => ({
	type: "text",
	text: value,
	...(marks.length > 0 ? { marks } : {}),
});

describe("checks of a stored document", () => {
	it("does not end a stretch of marked text at a line break or a footnote reference", () => {
		const note = { type: "untranslated" };
		const result = checkDocument(
			testSite,
			doc(
				paragraph(
					"aaaaaaaa",
					text("one", note),
					{ type: "hardBreak" },
					text("two", note),
					{ type: "footnoteReference", attrs: { label: "1" } },
					text("three", note),
				),
			),
		);
		const issue = result.issues.find((item) => item.code === "untranslated_text");
		expect(issue?.params).toEqual({ count: 1 });
	});

	it("takes the block of a node without an id from the block around it", () => {
		const result = checkDocument(
			testSite,
			doc({
				id: "cccccccc",
				type: "paragraph",
				content: [{ type: "image", attrs: { mediaId: "not-an-id", alt: "x" } }],
			}),
		);
		expect(result.issues).toContainEqual(
			expect.objectContaining({ code: "invalid_reference_id", position: { blockId: "cccccccc" } }),
		);
	});

	it("holds no references of a body it could not read, and says so", () => {
		const result = checkDocument(
			testSite,
			doc({ id: "dddddddd", type: "unparsed", attrs: { format: "mdx", source: "<Open" } }),
		);
		expect(result.unparsed).toBe(true);
		expect(result.incomplete).toBe(true);
		expect(result.issues).toEqual([
			expect.objectContaining({ code: "unparsed_body", position: { blockId: "dddddddd" } }),
		]);
		expect(result.mediaReferences).toEqual([]);
	});

	it("knows an empty document: no blocks, or only blank paragraphs", () => {
		expect(isEmptyDocument(doc())).toBe(true);
		expect(isEmptyDocument(doc(paragraph("aaaaaaaa"), paragraph("bbbbbbbb", text("  "))))).toBe(true);
		expect(isEmptyDocument(doc(paragraph("aaaaaaaa", text("x"))))).toBe(false);
		expect(isEmptyDocument(doc({ type: "horizontalRule" }))).toBe(false);
		expect(isEmptyDocument(docOf("Hello"))).toBe(false);
	});
});

describe("a document and its text are one body", () => {
	const prepare = (input: { body: string; format: string } | { doc: unknown }) =>
		prepareSnapshot(
			testSite,
			{ collection: contentCollection, slug: "same", metadata: { title: "Same" }, ...input } as never,
			{
				import: { formats: createFormatRegistry([paragraphsFormat]) },
			},
		);

	it("has the content hash of the text it was read from, whichever way it is sent", async () => {
		const written = "A bold and it with code and a [link](https://example.com).\n\nHeading";
		const fromText = await prepare({ body: written, format: "paragraphs" });
		const fromDocument = await prepare({ doc: fromText.doc });
		expect(fromDocument.contentHash).toBe(fromText.contentHash);
	});

	it("puts a document built by hand in the form the text reads as: split text joined, trailing blank paragraphs dropped", async () => {
		const byHand = {
			type: "doc",
			version: 2,
			content: [
				{
					type: "paragraph",
					content: [
						{ type: "text", text: "Hel" },
						{ type: "text", text: "lo" },
						{ type: "text", text: "" },
					],
				},
				{ type: "paragraph", content: [] },
			],
		};
		const fromDocument = await prepare({ doc: byHand });
		const fromText = await prepare({ format: "paragraphs", body: "Hello" });
		expect(fromDocument.contentHash).toBe(fromText.contentHash);
		expect(fromDocument.doc.content).toHaveLength(1);
	});

	it("gives every block of a document an id, keeps the ones it has, and takes the ones of the draft it replaces", async () => {
		const first = await prepare({ format: "paragraphs", body: "One\n\nTwo" });
		const sent = {
			type: "doc",
			version: 2,
			content: [
				{ id: first.doc.content[1]?.id, type: "paragraph", content: [{ type: "text", text: "Two" }] },
				{ type: "paragraph", content: [{ type: "text", text: "One" }] },
			],
		};
		const next = await prepareSnapshot(
			testSite,
			{ collection: contentCollection, slug: "same", metadata: { title: "Same" }, doc: sent },
			{ previousDoc: first.doc },
		);
		expect(next.doc.content[0]?.id).toBe(first.doc.content[1]?.id);
		// A block without an id pairs with the block of the draft that reads the same.
		expect(next.doc.content[1]?.id).toBe(first.doc.content[0]?.id);
	});
});
