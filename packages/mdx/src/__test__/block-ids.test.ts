import {
	BLOCK_ID_PATTERN,
	type CmsNode,
	forEachBlock,
	type StoredDocument,
	withoutBlockIds,
} from "@monti-cms/core/document";
import { describe, expect, it } from "vitest";
import { computeContentHash } from "../../../core/src/core/content-hash";
import { bodyFromDocument, bodyFromMdx } from "../body";

const docOf = (mdx: string, previous?: StoredDocument | null): StoredDocument => {
	const { doc } = bodyFromMdx(mdx, undefined, { previous });
	if (!doc) throw new Error("no document");
	return doc;
};

/** Block ids in document order, with the block's text, so tests read as "this block kept that id". */
const blocks = (doc: StoredDocument): { type: string; text: string; id: string }[] => {
	const out: { type: string; text: string; id: string }[] = [];
	const textOf = (node: CmsNode): string => (node.text ?? "") + (node.content ?? []).map(textOf).join("");
	forEachBlock(doc.content, (node) => out.push({ type: node.type, text: textOf(node), id: node.id ?? "" }));
	return out;
};

const idOf = (doc: StoredDocument, text: string, type = "paragraph") =>
	blocks(doc).find((block) => block.type === type && block.text === text)?.id;

const SAMPLE = [
	"# Title",
	"",
	"First paragraph.",
	"",
	"- one",
	"- two",
	"",
	'<TextAlign align="center">',
	"",
	"Centered.",
	"",
	"</TextAlign>",
	"",
	"| a | b |",
	"| - | - |",
	"| 1 | 2 |",
	"",
	"```ts",
	"const a = 1;",
	"```",
	"",
	"Last paragraph.",
	"",
].join("\n");

/** The block ids of a document read from MDX: the part of the block id behavior that depends on how a text is read and written. */
describe("block ids and MDX", () => {
	it("give every block, and only blocks, a unique id", () => {
		const all = blocks(docOf(SAMPLE));
		for (const block of all) expect(block.id).toMatch(BLOCK_ID_PATTERN);
		expect(new Set(all.map((block) => block.id)).size).toBe(all.length);
		// Inline nodes (text, marks, inline JSX) carry none.
		expect(JSON.stringify(docOf(SAMPLE))).not.toMatch(/"id":"[^"]+","text"|"id":"[^"]+","type":"text"/);
	});

	it("are not written to MDX and do not change the content hash", () => {
		const body = bodyFromMdx(SAMPLE);
		for (const { id } of blocks(body.doc as StoredDocument)) expect(body.mdx).not.toContain(id);
		const again = bodyFromMdx(SAMPLE);
		expect(again.doc).not.toEqual(body.doc);
		expect(computeContentHash({}, again.doc as StoredDocument)).toBe(
			computeContentHash({}, body.doc as StoredDocument),
		);
	});

	it("are inherited from the previous version when the same MDX is read again", () => {
		const first = docOf(SAMPLE);
		expect(docOf(SAMPLE, first)).toEqual(first);
	});

	it("survive an edited paragraph, an inserted block and a removed block", () => {
		const first = docOf(SAMPLE);
		const edited = docOf(
			SAMPLE.replace("First paragraph.", "First paragraph, edited.")
				.replace("Last paragraph.", "New paragraph.\n\nLast paragraph.")
				.replace("- two\n", ""),
			first,
		);
		expect(idOf(edited, "First paragraph, edited.")).toBe(idOf(first, "First paragraph."));
		expect(idOf(edited, "Last paragraph.")).toBe(idOf(first, "Last paragraph."));
		expect(idOf(edited, "Centered.")).toBe(idOf(first, "Centered."));
		expect(idOf(edited, "Title", "heading")).toBe(idOf(first, "Title", "heading"));
		const known = new Set(blocks(first).map((block) => block.id));
		expect(known.has(idOf(edited, "New paragraph.") as string)).toBe(false);
	});

	it("are kept from a stored document, and inherited when it has none", () => {
		const first = docOf(SAMPLE);
		expect(bodyFromDocument(first).doc).toEqual(first);
		const bare = { ...first, content: withoutBlockIds(first.content) };
		expect(bodyFromDocument(bare, undefined, { previous: first }).doc).toEqual(first);
		const fresh = bodyFromDocument(bare).doc as StoredDocument;
		expect(blocks(fresh).every((block) => BLOCK_ID_PATTERN.test(block.id))).toBe(true);
	});

	it("replace an id that is not a valid block id", () => {
		const first = docOf("One.\n");
		const odd = { ...first, content: [{ ...(first.content[0] as CmsNode), id: "NOT-AN-ID" }] };
		const id = (bodyFromDocument(odd).doc as StoredDocument).content[0]?.id;
		expect(id).toMatch(BLOCK_ID_PATTERN);
	});
});
