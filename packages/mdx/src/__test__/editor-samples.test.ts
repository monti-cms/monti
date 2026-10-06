import { buildEditorExtensions, OPAQUE_BLOCK_NAME, storedToTiptap, tiptapToStored } from "@monti-cms/admin/editor";
import { type StoredDocument, withoutBlockIds } from "@monti-cms/core/document";
import { getSchema, type JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { mdxBrowserFormat } from "../admin";
import { docOfMdx, readSamples } from "../testing";

/**
 * MDX text through the editor and back: the admin converts stored documents to Tiptap JSON and knows no text notation, so the tests that start from MDX notation
 * (and the real sample posts) live here, where the format is. Nodes must pass the editor's schema, or the real editor drops them.
 */

const schema = getSchema(buildEditorExtensions());
const throughSchema = (json: JSONContent): JSONContent => schema.nodeFromJSON(json).toJSON() as JSONContent;
const contentOf = (doc: StoredDocument) => withoutBlockIds(doc.content);
const throughEditor = (doc: StoredDocument): StoredDocument => tiptapToStored(throughSchema(storedToTiptap(doc)));
const mdxOfDoc = (doc: StoredDocument): string => mdxBrowserFormat.export(doc);

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

describe("MDX text <-> editor round trip", () => {
	it("does not lose inline marks, headings, and line breaks", () => {
		const first = docOfMdx(
			'문장 **굵게** *기울임* ~~취소~~ `코드` <u>밑줄</u> <sup>위</sup> <sub>아래</sub> <Tooltip content="설명">라벨</Tooltip> [링크](https://example.com "제목")\n\n## 제목\n\n첫 줄<br />\n둘째 줄',
		);
		expect(contentOf(throughEditor(first))).toEqual(contentOf(first));
	});

	it("maps every spelling of a line break to the editor's hardBreak and writes it back as one", () => {
		const spellings = ["가<br />나", "가\\\n나", "가  \n나"];
		const editorDocs = spellings.map((source) => throughSchema(storedToTiptap(docOfMdx(source))));
		for (const editorDoc of editorDocs)
			expect(contentOf(tiptapToStored(editorDoc))).toEqual(contentOf(tiptapToStored(editorDocs[0] as JSONContent)));
		expect(editorDocs[0]?.content?.[0]?.content?.map((node) => node.type)).toEqual(["text", "hardBreak", "text"]);

		expect(mdxOfDoc(tiptapToStored(editorDocs[0] as JSONContent))).toBe("가<br />\n나\n");
	});

	it("keeps a line break inside a table cell", () => {
		const first = docOfMdx("| a | b |\n| - | - |\n| x<br />y | z |\n");
		expect(contentOf(throughEditor(first))).toEqual(contentOf(first));
		expect(JSON.stringify(first)).toContain('"hardBreak"');
	});

	it("keeps the empty paragraphs between blocks through the text a source panel shows", () => {
		const paragraph = (text: string): JSONContent => ({ type: "paragraph", content: [{ type: "text", text }] });
		const count = 3;
		const typed: JSONContent = {
			type: "doc",
			content: [paragraph("앞"), ...Array.from({ length: count }, () => ({ type: "paragraph" })), paragraph("뒤")],
		};
		const saved = tiptapToStored(typed);
		const reloaded = throughSchema(storedToTiptap(docOfMdx(mdxOfDoc(saved))));
		const empty = (reloaded.content ?? []).filter((block) => block.type === "paragraph" && !block.content?.length);
		expect(empty).toHaveLength(count);
	});

	it("writes neither the trailing empty paragraph of the editor nor a line break for a new empty list item", () => {
		const paragraph = (text?: string): JSONContent =>
			text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" };
		expect(mdxOfDoc(tiptapToStored({ type: "doc", content: [paragraph("끝"), paragraph(), paragraph()] }))).toBe(
			"끝\n",
		);
		const list: JSONContent = {
			type: "doc",
			content: [
				{
					type: "bulletList",
					content: [
						{ type: "listItem", content: [paragraph("하나")] },
						{ type: "listItem", content: [paragraph()] },
					],
				},
			],
		};
		expect(mdxOfDoc(tiptapToStored(list))).not.toContain("<br />");
	});

	it("expands and collapses an alignment container", () => {
		const first = docOfMdx('<TextAlign align="center">\n\n## 가운데\n\n</TextAlign>');
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
		const first = docOfMdx(source);
		const json = storedToTiptap(first);

		const names = (json.content ?? []).map((block) => block?.type);
		// Valid Callout and Tabs are editable, while a line break with attributes has no editor node, so its paragraph is preserved as a box.
		expect(names).toEqual(["cmsCallout", "cmsTabs", "table", OPAQUE_BLOCK_NAME]);

		expect(contentOf(tiptapToStored(throughSchema(json)))).toEqual(contentOf(first));
	});

	it("keeps a box exactly as it was, nested ids and all, and gives it the id the editor holds", () => {
		const first = docOfMdx('단락 <br data-x="1" /> 안\n\n뒤');
		const json = throughSchema(storedToTiptap(first));
		const box = json.content?.[0];
		expect(box?.type).toBe(OPAQUE_BLOCK_NAME);

		const second = tiptapToStored(json);
		expect(contentOf(second)).toEqual(contentOf(first));
		expect(second.content[0]).toEqual(first.content[0]);
	});

	it("shows a box's node written in MDX, and as JSON when there is none", () => {
		const doc = docOfMdx('A<br data-x="1" />B');
		const plain = storedToTiptap(doc).content?.[0];
		expect(plain?.type).toBe(OPAQUE_BLOCK_NAME);
		expect(plain?.attrs?.preview).toBe("");

		const written = storedToTiptap(doc, {
			boxPreview: (node) => mdxBrowserFormat.export({ ...doc, content: [node] }).trim(),
		}).content?.[0];
		expect(written?.attrs?.preview).toBe(mdxOfDoc({ ...doc, content: [doc.content[0] as never] }).trim());
		expect(written?.attrs?.preview).toContain("<br");
		// What is shown is not what is saved: the box still holds the stored node.
		expect(tiptapToStored({ type: "doc", content: [written as JSONContent] }).content).toEqual(doc.content);
	});

	it("converts tables (with column alignment) and task lists to editable nodes and restores them", () => {
		const first = docOfMdx(
			"| a | **b** |\n| :-: | --: |\n| 1 | `2` |\n\n- [ ] 할 일\n- [x] 끝남\n\n1. [ ] 번호 체크 항목",
		);
		const json = storedToTiptap(first);
		expect((json.content ?? []).map((block) => block?.type)).toEqual(["table", "taskList", OPAQUE_BLOCK_NAME]);
		expect(contentOf(tiptapToStored(throughSchema(json)))).toEqual(contentOf(first));
	});

	it("does not lose image attributes", () => {
		const first = docOfMdx(
			'<Image mediaId="uuid-1" alt="설명" width="60%" align="left" caption="캡션" />\n\n![그냥](https://example.com/a.png)',
		);
		const json = storedToTiptap(first);

		expect(json.content?.[0]).toMatchObject({ type: "image", attrs: expect.objectContaining({ mediaId: "uuid-1" }) });

		expect(contentOf(tiptapToStored(throughSchema(json)))).toEqual(contentOf(first));
	});

	it("an explicit value equal to the editor default is normalized once on save and converges", () => {
		// `align="center"` is the render default, so it is dropped on save. The meaning is the same, and reopening gives the same result.
		const once = throughEditor(docOfMdx('<Image mediaId="uuid-1" alt="설명" align="center" />'));
		expect(JSON.stringify(once)).not.toContain("align");
		expect(contentOf(throughEditor(once))).toEqual(contentOf(once));
	});

	it("does not lose decorative images, and writes them as such", () => {
		const first = docOfMdx('<Image src="/images/a.png" alt="" decorative />');
		const second = throughEditor(first);
		expect(contentOf(second)).toEqual(contentOf(first));
		expect(mdxOfDoc(second)).toContain("decorative");
	});

	it("preserves an explicit width of 100%", () => {
		const first = docOfMdx('<Image src="/images/a.png" alt="설명" width="100%" />');
		const second = throughEditor(first);
		expect(contentOf(second)).toEqual(contentOf(first));
		expect(mdxOfDoc(second)).toContain('width="100%"');
	});

	it("keeps internal links as the id of their entry, without the address the editor shows", () => {
		const id = "6f1c0b0e-3c1d-4a0e-9f5a-0d9c2f1e7a11";
		const first = docOfMdx(`A [post](entry:${id}) and [site](https://example.com "T").`);
		const json = throughSchema(storedToTiptap(first));

		// The editor shows an address while the link is open; it is never saved.
		const shown = JSON.parse(JSON.stringify(json).replace('"href":null', '"href":"/posts/x"')) as JSONContent;
		const second = tiptapToStored(shown);
		expect(contentOf(second)).toEqual(contentOf(first));
		expect(JSON.stringify(second)).not.toContain("/posts/x");
		expect(mdxOfDoc(second)).toContain(`entry:${id}`);
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
			const first = docOfMdx(item.mdx);
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
