import { describe, expect, it } from "vitest";
import { contentCollection } from "../../../test/any-site";
import { paragraphsFormat } from "../../../test/paragraphs-format";
import { testSite } from "../../../test/site";
import { docOf, docOf as docOfText } from "../../../test/stored-content";
import { linkMarkAttrs, mapLinkAttrs } from "../../doc/entry-links";
import { STORED_DOCUMENT_VERSION, type StoredDocument } from "../../doc/stored-document";
import type { CmsNode } from "../../doc/types";
import { createFormatRegistry } from "../../format/registry";
import { checkDocument, isEmptyDocument } from "../body-check";
import { prepareSnapshot } from "../snapshot";

/** The checks of a stored document, on documents given directly (the cases a text cannot spell). */
const doc = (...content: CmsNode[]): StoredDocument => ({ type: "doc", version: 3, content });
const paragraph = (id: string, ...content: CmsNode[]): CmsNode => ({ id, type: "paragraph", content });
const text = (value: string, ...marks: CmsNode["marks"] & object): CmsNode => ({
	type: "text",
	text: value,
	...(marks.length > 0 ? { marks } : {}),
});

describe("checks of a stored document", () => {
	it("WRITE-P1 does not end a stretch of marked text at a line break or a footnote reference", () => {
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

	it("WRITE-P1 takes the block of a node without an id from the block around it", () => {
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

	it("WRITE-P8 holds no references of a body it could not read, and says so", () => {
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

	it("WRITE-P1 knows an empty document: no blocks, or only blank paragraphs", () => {
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

	it("WRITE-S3 has the content hash of the text it was read from, whichever way it is sent", async () => {
		const written = "A bold and it with code and a [link](https://example.com).\n\nHeading";
		const fromText = await prepare({ body: written, format: "paragraphs" });
		const fromDocument = await prepare({ doc: fromText.doc });
		expect(fromDocument.contentHash).toBe(fromText.contentHash);
	});

	it("WRITE-S3 puts a document built by hand in the form the text reads as: split text joined, trailing blank paragraphs dropped", async () => {
		const byHand = {
			type: "doc",
			version: 3,
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

	it("TRANS-B1 gives every block of a document an id, keeps the ones it has, and takes the ones of the draft it replaces", async () => {
		const first = await prepare({ format: "paragraphs", body: "One\n\nTwo" });
		const sent = {
			type: "doc",
			version: 3,
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

describe("checking links by entry id", () => {
	/** The text read by the test reader, with a link to `entry:<id>` made an entry link, as a format that knows the notation writes it. */
	const docOf = (text: string): StoredDocument => {
		const doc = docOfText(text);
		const content = mapLinkAttrs(doc.content, (attrs) =>
			typeof attrs.href === "string"
				? linkMarkAttrs(attrs.href, typeof attrs.title === "string" ? attrs.title : null)
				: undefined,
		);
		return { ...doc, content: content as CmsNode[] };
	};

	it("WRITE-P1 an id that is not an id is a body error and the body's references are not trusted", () => {
		const check = checkDocument(testSite, docOf("[x](entry:00000000-0000-4000-8000-000000000001)"));
		expect(check.entryLinks).toHaveLength(1);
		const bad = checkDocument(testSite, {
			type: "doc",
			version: 3,
			content: [
				{
					id: "aaaaaaaa",
					type: "paragraph",
					content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { entryId: "nope" } }] }],
				},
			],
		});
		expect(bad.issues.map((issue) => issue.code)).toContain("invalid_reference_id");
		expect(bad.incomplete).toBe(true);
	});
});

describe("footnote pre-publish validation (warnings only)", () => {
	/** A paragraph of the text with its `[^label]` markers made footnote references. */
	const paragraph = (text: string): CmsNode => {
		const content: CmsNode[] = [];
		let last = 0;
		for (const match of text.matchAll(/\[\^([^\]]+)\]/g)) {
			if ((match.index ?? 0) > last) content.push({ type: "text", text: text.slice(last, match.index) });
			content.push({ type: "footnoteReference", attrs: { label: match[1] ?? "" } });
			last = (match.index ?? 0) + match[0].length;
		}
		if (last < text.length) content.push({ type: "text", text: text.slice(last) });
		return { type: "paragraph", content };
	};
	/** A footnote definition of a label with one paragraph. */
	const definition = (label: string, text: string): CmsNode => ({
		type: "footnoteDefinition",
		attrs: { label },
		content: [paragraph(text)],
	});

	const footnoteWarnings = async (...content: CmsNode[]) => {
		const snapshot = await prepareSnapshot(testSite, {
			collection: contentCollection,
			slug: "footnotes",
			metadata: { title: "Footnotes" },
			doc: { type: "doc", version: STORED_DOCUMENT_VERSION, content },
		} as never);
		return {
			snapshot,
			warnings: (snapshot.warnings ?? []).filter((warning) => warning.code.startsWith("footnote_")),
		};
	};

	it("EDIT-F1 warns about a reference without a definition", async () => {
		const { warnings, snapshot } = await footnoteWarnings(
			paragraph("Text[^1] and more[^gone]."),
			definition("1", "one"),
		);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toMatchObject({
			code: "footnote_definition_missing",
			message: "gone",
			params: { label: "gone" },
			// The paragraph that holds the reference.
			position: { blockId: snapshot.doc.content[0]?.id },
		});
		// It is a warning, not a blocking issue.
		expect(snapshot.issues).toEqual([]);
	});

	it("EDIT-F1 warns about a definition that no reference uses", async () => {
		const { warnings, snapshot } = await footnoteWarnings(
			paragraph("Text[^1]"),
			definition("1", "one"),
			definition("spare", "nobody cites me"),
		);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toMatchObject({
			code: "footnote_definition_unused",
			message: "spare",
			params: { label: "spare" },
			// The definition that nobody cites: the third block.
			position: { blockId: snapshot.doc.content[2]?.id },
		});
		expect(snapshot.issues).toEqual([]);
	});

	it("EDIT-F1 matches labels case-insensitively", async () => {
		const { warnings } = await footnoteWarnings(paragraph("Text[^Note]"), definition("note", "one"));
		expect(warnings).toEqual([]);
	});
});
