import { STORED_DOCUMENT_VERSION, type StoredDocument, withoutBlockIds } from "@monti-cms/core/document";
import { readSamples } from "@monti-cms/core/testing";
import type { JSONContent } from "@tiptap/core";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { mdxBrowserFormat } from "../../mdx-source/format";
import { docOf, mdxOfDoc, mdxOfTiptap, tiptapOf } from "../../test/mdx";
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

const firstDiff = (a: unknown, b: unknown, at: string): string | null => {
	if (a === b) return null;
	if (typeof a !== typeof b || a === null || b === null)
		return `${at}: ${JSON.stringify(a)?.slice(0, 100)} !== ${JSON.stringify(b)?.slice(0, 100)}`;
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return `${at}.length: ${a.length} !== ${b.length}`;
		for (let i = 0; i < a.length; i += 1) {
			const diff = firstDiff(a[i], b[i], `${at}[${i}]`);
			if (diff) return diff;
		}
		return null;
	}
	if (typeof a === "object") {
		for (const key of new Set([...Object.keys(a as object), ...Object.keys(b as object)])) {
			const diff = firstDiff((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${at}.${key}`);
			if (diff) return diff;
		}
		return null;
	}
	return `${at}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`;
};

describe("stored document <-> Tiptap round trip", () => {
	it("does not lose inline marks, headings, and line breaks", () => {
		const first = docOf(
			'문장 **굵게** *기울임* ~~취소~~ `코드` <u>밑줄</u> <sup>위</sup> <sub>아래</sub> <Tooltip content="설명">라벨</Tooltip> [링크](https://example.com "제목")\n\n## 제목\n\n첫 줄<br />\n둘째 줄',
		);

		expect(contentOf(throughEditor(first))).toEqual(contentOf(first));
	});

	it("maps a line break to the editor's hardBreak and back to the one document node", () => {
		const spellings = ["가<br />나", "가\\\n나", "가  \n나"];
		const editorDocs = spellings.map((source) => throughSchema(tiptapOf(source)));
		for (const editorDoc of editorDocs) expect(editorDoc).toEqual(editorDocs[0]);
		expect(editorDocs[0]?.content?.[0]?.content?.map((node) => node.type)).toEqual(["text", "hardBreak", "text"]);

		const saved = tiptapToStored(editorDocs[0] as JSONContent);
		expect(saved.content[0]?.content?.map((node) => node.type)).toEqual(["text", "hardBreak", "text"]);
		expect(mdxOfDoc(saved)).toBe("가<br />\n나\n");
	});

	it("keeps a line break inside a table cell", () => {
		const first = docOf("| a | b |\n| - | - |\n| x<br />y | z |\n");
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
			// The same through the text a source panel shows.
			expect(emptyParagraphs(throughSchema(tiptapOf(mdxOfDoc(saved))))).toBe(count);
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
			expect(mdxOfTiptap(editorDoc(paragraph("끝"), paragraph(), paragraph()))).toBe("끝\n");
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
			expect(mdxOfDoc(saved)).not.toContain("<br />");
			expect(contentOf(throughEditor(saved))).toEqual(contentOf(saved));
		});
	});

	it("expands and collapses an alignment container", () => {
		const first = docOf('<TextAlign align="center">\n\n## 가운데\n\n</TextAlign>');
		const json = storedToTiptap(first);

		expect(json.content?.[0]).toMatchObject({
			type: "heading",
			attrs: expect.objectContaining({ textAlign: "center" }),
		});

		const second = tiptapToStored(throughSchema(json));
		expect(contentOf(second)).toEqual(contentOf(first));
		expect(second.content[0]?.type).toBe("text-align");
		expect(mdxOfDoc(second)).toContain("<TextAlign");
	});

	it("preserves blocks not in the schema as boxes and restores them", () => {
		const source = [
			'<Callout variant="note">\n\n보존\n\n</Callout>',
			'<Tabs>\n\n<Tab label="a">\n\nA\n\n</Tab>\n\n<Tab label="b">\n\nB\n\n</Tab>\n\n</Tabs>',
			"| a | b |\n| --- | --- |\n| 1 | 2 |",
			'A<br data-x="1" />B',
		].join("\n\n");
		const first = docOf(source);
		const json = storedToTiptap(first);

		const names = (json.content ?? []).map((block) => block?.type);
		// Valid Callout and Tabs are editable, while a line break with attributes has no editor node, so its paragraph is preserved as a box.
		expect(names).toEqual(["cmsCallout", "cmsTabs", "table", OPAQUE_BLOCK_NAME]);

		expect(contentOf(tiptapToStored(throughSchema(json)))).toEqual(contentOf(first));
	});

	it("keeps a box exactly as it was, nested ids and all, and gives it the id the editor holds", () => {
		const first = docOf('단락 <br data-x="1" /> 안\n\n뒤');
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
		const doc = docOf('A<br data-x="1" />B');
		const plain = storedToTiptap(doc).content?.[0];
		expect(plain?.type).toBe(OPAQUE_BLOCK_NAME);
		expect(plain?.attrs?.preview).toBe("");

		const written = storedToTiptap(doc, { boxPreview: boxPreviewOf(mdxBrowserFormat) }).content?.[0];
		expect(written?.attrs?.preview).toBe(mdxOfDoc({ ...doc, content: [doc.content[0] as never] }).trim());
		expect(written?.attrs?.preview).toContain("<br");
		// What is shown is not what is saved: the box still holds the stored node.
		expect(tiptapToStored({ type: "doc", content: [written as JSONContent] }).content).toEqual(doc.content);
		expect(
			throughSchema(storedToTiptap(doc, { boxPreview: boxPreviewOf(mdxBrowserFormat) })).content?.[0]?.attrs?.preview,
		).toContain("<br");
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

	it("converts tables (with column alignment) and task lists to editable nodes and restores them", () => {
		const first = docOf(
			"| a | **b** |\n| :-: | --: |\n| 1 | `2` |\n\n- [ ] 할 일\n- [x] 끝남\n\n1. [ ] 번호 체크 항목",
		);
		const json = storedToTiptap(first);
		expect((json.content ?? []).map((block) => block?.type)).toEqual(["table", "taskList", OPAQUE_BLOCK_NAME]);
		expect(contentOf(tiptapToStored(throughSchema(json)))).toEqual(contentOf(first));
	});

	it("does not lose image attributes", () => {
		const first = docOf(
			'<Image mediaId="uuid-1" alt="설명" width="60%" align="left" caption="캡션" />\n\n![그냥](https://example.com/a.png)',
		);
		const json = storedToTiptap(first);

		expect(json.content?.[0]).toMatchObject({ type: "image", attrs: expect.objectContaining({ mediaId: "uuid-1" }) });

		expect(contentOf(tiptapToStored(throughSchema(json)))).toEqual(contentOf(first));
	});

	it("an explicit value equal to the Tiptap default is normalized once on save and converges", () => {
		// `align="center"` is the render default, so it is dropped on save. The meaning is the same, and reopening gives the same result.
		const source = '<Image mediaId="uuid-1" alt="설명" align="center" />';
		const once = throughEditor(docOf(source));
		expect(JSON.stringify(once)).not.toContain("align");
		expect(contentOf(throughEditor(once))).toEqual(contentOf(once));
	});

	it("does not lose decorative images", () => {
		const first = docOf('<Image src="/images/a.png" alt="" decorative />');
		const json = storedToTiptap(first);

		expect(json.content?.[0]).toMatchObject({
			type: "image",
			attrs: expect.objectContaining({ decorative: true }),
		});

		const second = tiptapToStored(throughSchema(json));
		expect(contentOf(second)).toEqual(contentOf(first));
		expect(mdxOfDoc(second)).toContain("decorative");
	});

	it("preserves an explicit width of 100%", () => {
		const first = docOf('<Image src="/images/a.png" alt="설명" width="100%" />');
		const second = throughEditor(first);
		expect(contentOf(second)).toEqual(contentOf(first));
		expect(mdxOfDoc(second)).toContain('width="100%"');
	});

	it("the upload insertion shape comes back as is", () => {
		const first = docOf(
			'<Image mediaId="uuid-1" src="https://r2.example/a.png" alt="a.png" width="100%" align="center" />',
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
		const first = docOf(`A [post](entry:${id}) and [site](https://example.com "T").`);
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

describe("loads real content into the editor and restores it", () => {
	it("all sample content passes the schema and the document is the same", () => {
		const items = readSamples();
		expect(items.length).toBeGreaterThan(0);

		const failures: string[] = [];
		let checked = 0;
		for (const item of items) {
			// Samples written with a syntax extension this config does not enable are not readable here; the others must all go through.
			if (!mdxBrowserFormat.import(item.mdx).ok) continue;
			checked += 1;
			const first = docOf(item.mdx);
			let json: JSONContent;
			try {
				json = throughSchema(storedToTiptap(first));
			} catch (error) {
				failures.push(`${item.name}: schema rejected (${error instanceof Error ? error.message : String(error)})`);
				continue;
			}
			const second = tiptapToStored(json);
			try {
				expect(contentOf(second)).toEqual(contentOf(first));
			} catch {
				failures.push(`${item.name}: document mismatch (${firstDiff(contentOf(first), contentOf(second), "")})`);
			}
		}

		expect(checked).toBeGreaterThan(0);
		expect(failures).toEqual([]);
	});
});
