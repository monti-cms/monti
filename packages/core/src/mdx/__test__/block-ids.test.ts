import { describe, expect, it } from "vitest";
import { computeContentHash } from "../../core/content-hash";
import { assignBlockIds, BLOCK_ID_PATTERN, forEachBlock, withoutBlockIds } from "../block-ids";
import { bodyFromDocument, bodyFromMdx, type StoredDocument } from "../stored-document";
import type { CmsNode } from "../types";

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

describe("block ids", () => {
	it("gives every block, and only blocks, a unique id", () => {
		const doc = docOf(SAMPLE);
		const all = blocks(doc);
		expect(all.map((block) => block.type)).toEqual([
			"heading",
			"paragraph",
			"bulletList",
			"listItem",
			"paragraph",
			"listItem",
			"paragraph",
			"text-align",
			"paragraph",
			"table",
			"tableRow",
			"tableCell",
			"tableCell",
			"tableRow",
			"tableCell",
			"tableCell",
			"codeBlock",
			"paragraph",
		]);
		for (const block of all) expect(block.id).toMatch(BLOCK_ID_PATTERN);
		expect(new Set(all.map((block) => block.id)).size).toBe(all.length);
		// Inline nodes (text, marks, inline JSX) carry none.
		expect(JSON.stringify(doc)).not.toMatch(/"id":"[^"]+","text"|"id":"[^"]+","type":"text"/);
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

	it("keep the id on the first part of a split paragraph", () => {
		const first = docOf("Alpha beta.\n\nGamma.\n");
		const split = docOf("Alpha\n\nbeta.\n\nGamma.\n", first);
		expect(idOf(split, "Alpha")).toBe(idOf(first, "Alpha beta."));
		expect(idOf(split, "beta.")).not.toBe(idOf(first, "Alpha beta."));
		expect(idOf(split, "Gamma.")).toBe(idOf(first, "Gamma."));
	});

	it("follow a moved block", () => {
		const first = docOf("One.\n\nTwo.\n\nThree.\n\n```js\nx\n```\n");
		const moved = docOf("```js\nx\n```\n\nOne.\n\nTwo.\n\nThree.\n", first);
		expect(idOf(moved, "x", "codeBlock")).toBe(idOf(first, "x", "codeBlock"));
		expect(idOf(moved, "Three.")).toBe(idOf(first, "Three."));
	});

	it("give a copy of a block a new id: the first block with an id keeps it", () => {
		const first = docOf("One.\n\nTwo.\n");
		const [one] = first.content as CmsNode[];
		const pasted = assignBlockIds([...first.content, { ...(one as CmsNode) }]);
		const ids = pasted.map((node) => node.id);
		expect(ids[0]).toBe(one?.id);
		expect(ids[2]).not.toBe(one?.id);
		expect(new Set(ids).size).toBe(3);
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
