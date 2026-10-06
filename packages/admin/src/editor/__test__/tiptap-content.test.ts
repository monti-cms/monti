import { type CmsNode, STORED_DOCUMENT_VERSION, type StoredDocument, withoutBlockIds } from "@monti-cms/core/document";
import type { JSONContent } from "@tiptap/core";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { docOf, tiptapOf } from "../../test/mdx";
import { ADDED_MARKS, addedMarkName, createAddedMark } from "../added-marks";
import { BLOCK_NODES } from "../block-views";
import { ADDED_BLOCK_NODES } from "../blocks/added";
import { CmsLinkEntryId } from "../link-entry-id";
import { boxPreviewOf, OPAQUE_BLOCK_NAME, storedToTiptap, tiptapToStored } from "../tiptap-content";
import { CMS_SCHEMA_EXTENSIONS } from "../tiptap-schema";

/**
 * Same composition as the extensions array in `tiptap-editor.tsx`. Update this too when that changes.
 * Nodes must pass schema validation, or the real editor drops them.
 */
const schema = getSchema([
	StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false }),
	...CMS_SCHEMA_EXTENSIONS,
	CmsLinkEntryId,
	...Object.values(BLOCK_NODES),
	...ADDED_BLOCK_NODES,
	...[...ADDED_MARKS.values()].map((block) => createAddedMark(block)),
]);

/** Checks that it passes the Tiptap schema. If not, the real editor silently drops it. */
const throughSchema = (json: JSONContent): JSONContent => schema.nodeFromJSON(json).toJSON() as JSONContent;

/** What a document says: its blocks without the ids the editor and the server give them. */
const contentOf = (doc: StoredDocument) => withoutBlockIds(doc.content);

/** A body through the editor and back: the stored document, then Tiptap JSON that passes the schema, then the stored document again. */
const throughEditor = (doc: StoredDocument): StoredDocument => tiptapToStored(throughSchema(storedToTiptap(doc)));

/** A stored document of hand-built blocks. */
const docOfBlocks = (...content: CmsNode[]): StoredDocument => ({
	type: "doc",
	version: STORED_DOCUMENT_VERSION,
	content,
});
const text = (value: string): CmsNode => ({ type: "text", text: value });

describe("stored document <-> Tiptap round trip", () => {
	it("does not lose inline marks, headings, and line breaks", () => {
		const first = docOf(
			'문장 **굵게** *기울임* ~~취소~~ `코드` [링크](https://example.com "제목")\n\n## 제목\n\n첫 줄<br />둘째 줄',
		);
		expect(JSON.stringify(first)).toContain("hardBreak");

		expect(contentOf(throughEditor(first))).toEqual(contentOf(first));
	});

	it("maps a line break to the editor's hardBreak and back to the one document node", () => {
		const editorDoc = throughSchema(tiptapOf("가<br />나"));
		expect(editorDoc.content?.[0]?.content?.map((node) => node.type)).toEqual(["text", "hardBreak", "text"]);

		const saved = tiptapToStored(editorDoc);
		expect(saved.content[0]?.content?.map((node) => node.type)).toEqual(["text", "hardBreak", "text"]);
	});

	it("keeps a line break inside a table cell", () => {
		const cell = (...content: CmsNode[]): CmsNode => ({ type: "tableCell", content });
		const first = docOfBlocks({
			type: "table",
			content: [
				{ type: "tableRow", content: [cell(text("a")), cell(text("b"))] },
				{ type: "tableRow", content: [cell(text("x"), { type: "hardBreak" }, text("y")), cell(text("z"))] },
			],
		});
		expect(storedToTiptap(first).content?.[0]?.type).toBe("table");
		expect(contentOf(throughEditor(first))).toEqual(contentOf(first));
		expect(JSON.stringify(first)).toContain('"hardBreak"');
	});

	describe("empty lines typed in the editor", () => {
		const paragraph = (text?: string): JSONContent =>
			text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" };
		const editorDoc = (...blocks: JSONContent[]): JSONContent => ({ type: "doc", content: blocks });
		const emptyParagraphs = (json: JSONContent) =>
			(json.content ?? []).filter((block) => block.type === "paragraph" && !block.content?.length).length;

		it.each([1, 2, 3, 6])("keep %i empty paragraphs between blocks through save, reload and save", (count) => {
			const typed = editorDoc(paragraph("앞"), ...Array.from({ length: count }, () => paragraph()), paragraph("뒤"));

			const saved = tiptapToStored(typed);
			const reloaded = throughSchema(storedToTiptap(saved));

			expect(emptyParagraphs(reloaded)).toBe(count);
			expect(reloaded.content?.map((block) => block.type)).toEqual(typed.content?.map((block) => block.type));
			expect(contentOf(tiptapToStored(reloaded))).toEqual(contentOf(saved));
		});

		it("keep empty paragraphs before a block and between other kinds of blocks", () => {
			const typed = editorDoc(
				paragraph(),
				{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "제목" }] },
				paragraph(),
				paragraph(),
				{ type: "horizontalRule" },
				paragraph("끝"),
			);
			const saved = tiptapToStored(typed);
			const reloaded = throughSchema(storedToTiptap(saved));
			expect(reloaded.content?.map((block) => block.type)).toEqual(typed.content?.map((block) => block.type));
			expect(contentOf(tiptapToStored(reloaded))).toEqual(contentOf(saved));
		});

		it("do not store the empty paragraph the editor keeps at the end, nor make an empty body not empty", () => {
			expect(tiptapToStored(editorDoc(paragraph())).content).toEqual([]);
			expect(tiptapToStored(editorDoc(paragraph("끝"), paragraph(), paragraph())).content).toHaveLength(1);
			const fence = { type: "codeBlock", attrs: { language: "ts" }, content: [{ type: "text", text: "a();" }] };
			expect(contentOf(tiptapToStored(editorDoc(fence, paragraph())))).toEqual(
				contentOf(tiptapToStored(editorDoc(fence))),
			);
		});

		it("keep a new, empty list item and an empty quote as they were", () => {
			const typed = editorDoc({
				type: "bulletList",
				content: [
					{ type: "listItem", content: [paragraph("하나")] },
					{ type: "listItem", content: [paragraph()] },
				],
			});
			const saved = tiptapToStored(typed);
			expect(JSON.stringify(saved)).not.toContain("hardBreak");
			expect(contentOf(throughEditor(saved))).toEqual(contentOf(saved));
		});
	});

	it("expands and collapses an alignment container", () => {
		const first = docOfBlocks({
			type: "text-align",
			id: "align001",
			attrs: { align: "center" },
			content: [{ type: "heading", id: "head0001", attrs: { level: 2 }, content: [text("가운데")] }],
		});
		const json = storedToTiptap(first);

		expect(json.content?.[0]).toMatchObject({
			type: "heading",
			attrs: expect.objectContaining({ textAlign: "center" }),
		});

		const second = tiptapToStored(throughSchema(json));
		expect(contentOf(second)).toEqual(contentOf(first));
		expect(second.content[0]?.type).toBe("text-align");
	});

	/** A block the editor has no node for. */
	const unknownBlock = (id: string): CmsNode => ({ type: "mystery-block", id, attrs: { kind: "x", nested: { n: 1 } } });

	it("preserves blocks not in the schema as boxes and restores them", () => {
		const first = docOfBlocks({ type: "paragraph", id: "para0001", content: [text("앞")] }, unknownBlock("mist0001"), {
			type: "horizontalRule",
			id: "rule0001",
		});
		const json = storedToTiptap(first);

		const names = (json.content ?? []).map((block) => block?.type);
		expect(names).toEqual(["paragraph", OPAQUE_BLOCK_NAME, "horizontalRule"]);

		expect(contentOf(tiptapToStored(throughSchema(json)))).toEqual(contentOf(first));
	});

	it("keeps a box exactly as it was, nested ids and all, and gives it the id the editor holds", () => {
		const first = docOfBlocks(unknownBlock("mist0001"), { type: "paragraph", id: "para0001", content: [text("뒤")] });
		const json = throughSchema(storedToTiptap(first));
		const box = json.content?.[0];
		expect(box?.type).toBe(OPAQUE_BLOCK_NAME);

		const second = tiptapToStored(json);
		expect(contentOf(second)).toEqual(contentOf(first));
		expect(second.content[0]).toEqual(first.content[0]);

		// A copy of the box gets a new id from the editor, and the saved node follows it.
		const copied = { ...json, content: [{ ...box, attrs: { ...box?.attrs, blockId: "zzzzzzzz" } }] } as JSONContent;
		expect(tiptapToStored(copied).content[0]?.id).toBe("zzzzzzzz");
	});

	it("shows a box's node written in the registered format, and as JSON when there is none", () => {
		const doc = docOfBlocks(unknownBlock("mist0001"));
		const plain = storedToTiptap(doc).content?.[0];
		expect(plain?.type).toBe(OPAQUE_BLOCK_NAME);
		expect(plain?.attrs?.preview).toBe("");

		// A format of its own: it writes each block as its type name.
		const format = { export: (written: StoredDocument) => `<${written.content[0]?.type}>\n` };
		const written = storedToTiptap(doc, { boxPreview: boxPreviewOf(format) }).content?.[0];
		expect(written?.attrs?.preview).toBe("<mystery-block>");
		// What is shown is not what is saved: the box still holds the stored node.
		expect(tiptapToStored({ type: "doc", content: [written as JSONContent] }).content).toEqual(doc.content);
		expect(throughSchema(storedToTiptap(doc, { boxPreview: boxPreviewOf(format) })).content?.[0]?.attrs?.preview).toBe(
			"<mystery-block>",
		);
	});

	it("keeps a body that could not be read as a box holding its text", () => {
		const unparsed: StoredDocument = {
			type: "doc",
			version: STORED_DOCUMENT_VERSION,
			content: [{ type: "unparsed", id: "abcd1234", attrs: { format: "mdx", source: "# Hello\n\n<Component>" } }],
		};
		const json = throughSchema(storedToTiptap(unparsed));
		expect(json.content).toHaveLength(1);
		expect(json.content?.[0]?.type).toBe(OPAQUE_BLOCK_NAME);
		expect(tiptapToStored(json).content).toEqual(unparsed.content);
	});

	it("converts tables and task lists to editable nodes and restores them", () => {
		const cell = (value: string): CmsNode => ({ type: "tableCell", content: [text(value)] });
		const first = docOfBlocks(
			{
				type: "table",
				id: "tabl0001",
				attrs: { align: ["center", "right"] },
				content: [
					{ type: "tableRow", content: [cell("a"), cell("b")] },
					{ type: "tableRow", content: [cell("1"), cell("2")] },
				],
			},
			{
				type: "bulletList",
				id: "task0001",
				content: [
					{ type: "listItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [text("할 일")] }] },
					{ type: "listItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [text("끝남")] }] },
				],
			},
		);
		const json = storedToTiptap(first);
		expect((json.content ?? []).map((block) => block?.type)).toEqual(["table", "taskList"]);
		expect(contentOf(tiptapToStored(throughSchema(json)))).toEqual(contentOf(first));
	});

	const imageBlock = (attrs: NonNullable<CmsNode["attrs"]>): CmsNode => ({ type: "image", id: "imag0001", attrs });

	it("does not lose image attributes", () => {
		const first = docOfBlocks(
			imageBlock({ mediaId: "uuid-1", alt: "설명", width: "60%", align: "left", caption: "캡션" }),
			imageBlock({ src: "https://example.com/a.png", alt: "그냥" }),
		);
		const json = storedToTiptap(first);

		expect(json.content?.[0]).toMatchObject({ type: "image", attrs: expect.objectContaining({ mediaId: "uuid-1" }) });

		expect(contentOf(tiptapToStored(throughSchema(json)))).toEqual(contentOf(first));
	});

	it("an explicit value equal to the Tiptap default is normalized once on save and converges", () => {
		// `align="center"` is the render default, so it is dropped on save. The meaning is the same, and reopening gives the same result.
		const once = throughEditor(docOfBlocks(imageBlock({ mediaId: "uuid-1", alt: "설명", align: "center" })));
		expect(JSON.stringify(once)).not.toContain("align");
		expect(contentOf(throughEditor(once))).toEqual(contentOf(once));
	});

	it("does not lose decorative images", () => {
		const first = docOfBlocks(imageBlock({ src: "/images/a.png", alt: "", decorative: true }));
		const json = storedToTiptap(first);

		expect(json.content?.[0]).toMatchObject({
			type: "image",
			attrs: expect.objectContaining({ decorative: true }),
		});

		const second = tiptapToStored(throughSchema(json));
		expect(contentOf(second)).toEqual(contentOf(first));
		expect(JSON.stringify(second)).toContain("decorative");
	});

	it("preserves an explicit width of 100%", () => {
		const first = docOfBlocks(imageBlock({ src: "/images/a.png", alt: "설명", width: "100%" }));
		const second = throughEditor(first);
		expect(contentOf(second)).toEqual(contentOf(first));
		expect(JSON.stringify(second)).toContain('"width":"100%"');
	});

	it("the upload insertion shape comes back as is", () => {
		const first = docOfBlocks(
			imageBlock({ mediaId: "uuid-1", src: "https://r2.example/a.png", alt: "a.png", width: "100%", align: "center" }),
		);
		const second = throughEditor(first);
		// Only `align="center"` is dropped.
		expect(contentOf(second)).toEqual([
			{
				type: "image",
				attrs: { alt: "a.png", mediaId: "uuid-1", src: "https://r2.example/a.png", width: "100%" },
			},
		]);
	});

	it("keeps internal links as the id of their entry, without the address the editor shows", () => {
		const id = "6f1c0b0e-3c1d-4a0e-9f5a-0d9c2f1e7a11";
		const first = docOfBlocks({
			type: "paragraph",
			id: "para0001",
			content: [
				text("A "),
				{ type: "text", text: "post", marks: [{ type: "link", attrs: { entryId: id } }] },
				text(" and site."),
			],
		});
		const json = throughSchema(storedToTiptap(first));
		const marks = (json.content?.[0]?.content ?? []).flatMap((node) => node.marks ?? []);
		expect(marks.find((mark) => mark.attrs?.entryId === id)?.attrs?.href ?? null).toBeNull();

		// The editor shows an address while the link is open; it is never saved.
		const shown = JSON.parse(JSON.stringify(json).replace('"href":null', '"href":"/posts/x"')) as JSONContent;
		const second = tiptapToStored(shown);
		expect(contentOf(second)).toEqual(contentOf(first));
		expect(JSON.stringify(second)).not.toContain("/posts/x");
	});

	it("the mark name of the added text decoration (block extension tooltip) matches the schema", () => {
		expect(schema.marks[addedMarkName("tooltip")]).toBeDefined();
		expect(schema.nodes[OPAQUE_BLOCK_NAME]).toBeDefined();
	});

	it("gives the stored document in its canonical form: keys sorted, one text run per mark set", () => {
		const typed: JSONContent = {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{ type: "text", text: "a" },
						{ type: "text", text: "b" },
						{ type: "text", text: "c", marks: [{ type: "bold" }] },
					],
				},
			],
		};
		const stored = tiptapToStored(typed);
		expect(stored.content[0]?.content).toEqual([
			{ text: "ab", type: "text" },
			{ marks: [{ type: "bold" }], text: "c", type: "text" },
		]);
		expect(Object.keys(stored.content[0] ?? {})).toEqual([...Object.keys(stored.content[0] ?? {})].sort());
	});
});
