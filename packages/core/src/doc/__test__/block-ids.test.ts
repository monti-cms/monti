import { describe, expect, it } from "vitest";
import { docOf as docOfText } from "../../../test/stored-content";
import { computeContentHash } from "../../core/content-hash";
import { assignBlockIds, BLOCK_ID_PATTERN, forEachBlock, regenerateBlockIds, withoutBlockIds } from "../block-ids";
import { canonicalDocument, STORED_DOCUMENT_VERSION, type StoredDocument } from "../stored-document";
import type { CmsNode } from "../types";

const text = (value: string): CmsNode => ({ type: "text", text: value });
const paragraph = (value: string): CmsNode => ({ type: "paragraph", content: [text(value)] });

/** A document of the given blocks, with ids that pair with the blocks of `previous` where they match (as every write gives them). */
const docWith = (content: CmsNode[], previous?: StoredDocument | null): StoredDocument => {
	const doc = canonicalDocument({ type: "doc", version: STORED_DOCUMENT_VERSION, content });
	return { ...doc, content: assignBlockIds(doc.content, [previous?.content]) };
};

/** The text reader of the core tests (it knows headings, paragraphs, lists and fenced code), with ids paired with those of `previous`. */
const docOf = (source: string, previous?: StoredDocument | null): StoredDocument => docOfText(source, previous);

/** What a block says in the sample: a heading, paragraphs, a list, a block with attributes, a table and a code block, as a format reads them. */
interface Changes {
	readonly first?: string;
	readonly afterCentered?: string;
	readonly withoutSecondItem?: boolean;
	readonly last?: string;
}

const sample = (changes: Changes = {}, previous?: StoredDocument | null): StoredDocument =>
	docWith(
		[
			{ type: "heading", attrs: { level: 1 }, content: [text("Title")] },
			paragraph(changes.first ?? "First paragraph."),
			{
				type: "bulletList",
				content: [
					{ type: "listItem", content: [paragraph("one")] },
					...(changes.withoutSecondItem ? [] : [{ type: "listItem", content: [paragraph("two")] }]),
				],
			},
			{ type: "text-align", attrs: { align: "center" }, content: [paragraph("Centered.")] },
			{
				type: "table",
				content: [
					{
						type: "tableRow",
						content: [
							{ type: "tableCell", content: [text("a")] },
							{ type: "tableCell", content: [text("b")] },
						],
					},
					{
						type: "tableRow",
						content: [
							{ type: "tableCell", content: [text("1")] },
							{ type: "tableCell", content: [text("2")] },
						],
					},
				],
			},
			{ type: "codeBlock", attrs: { language: "ts", meta: "", code: "const a = 1;" } },
			...(changes.afterCentered ? [paragraph(changes.afterCentered)] : []),
			paragraph(changes.last ?? "Last paragraph."),
		],
		previous,
	);

/** Block ids in document order, with the block's text, so tests read as "this block kept that id". */
const blocks = (doc: StoredDocument): { type: string; text: string; id: string }[] => {
	const out: { type: string; text: string; id: string }[] = [];
	const textOf = (node: CmsNode): string =>
		(node.text ?? "") +
		(typeof node.attrs?.code === "string" ? node.attrs.code : "") +
		(node.content ?? []).map(textOf).join("");
	forEachBlock(doc.content, (node) => out.push({ type: node.type, text: textOf(node), id: node.id ?? "" }));
	return out;
};

const idOf = (doc: StoredDocument, text: string, type = "paragraph") =>
	blocks(doc).find((block) => block.type === type && block.text === text)?.id;

describe("block ids", () => {
	it("gives every block, and only blocks, a unique id", () => {
		const doc = sample();
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

	it("do not change the content hash", () => {
		const body = sample();
		const again = sample();
		expect(again).not.toEqual(body);
		expect(computeContentHash({}, again)).toBe(computeContentHash({}, body));
	});

	it("are inherited from the previous version when the same content is read again", () => {
		const first = sample();
		expect(sample({}, first)).toEqual(first);
		const text = docOf("# Title\n\nOne.\n\n- a\n- b\n");
		expect(docOf("# Title\n\nOne.\n\n- a\n- b\n", text)).toEqual(text);
	});

	it("survive an edited paragraph, an inserted block and a removed block", () => {
		const first = sample();
		const edited = sample(
			{ first: "First paragraph, edited.", afterCentered: "New paragraph.", withoutSecondItem: true },
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
		const first = docOf("One.\n\nTwo.\n\nThree.\n\nFour.\n");
		const moved = docOf("Four.\n\nOne.\n\nTwo.\n\nThree.\n", first);
		expect(idOf(moved, "Four.")).toBe(idOf(first, "Four."));
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
		const first = sample();
		expect(assignBlockIds(first.content, [first.content])).toEqual(first.content);
		const bare = withoutBlockIds(first.content);
		expect(assignBlockIds(bare, [first.content])).toEqual(first.content);
		const fresh = assignBlockIds(bare);
		expect(blocks({ ...first, content: fresh }).every((block) => BLOCK_ID_PATTERN.test(block.id))).toBe(true);
	});

	it("replace an id that is not a valid block id", () => {
		const first = docOf("One.\n");
		const odd = [{ ...(first.content[0] as CmsNode), id: "NOT-AN-ID" }];
		expect(assignBlockIds(odd)[0]?.id).toMatch(BLOCK_ID_PATTERN);
	});

	it("are all new when a body is copied into another: nothing of the copy's ids is kept", () => {
		const original = sample();
		const copy = { ...original, content: regenerateBlockIds(original.content) };

		const before = blocks(original);
		const after = blocks(copy);
		expect(after.map((block) => block.text)).toEqual(before.map((block) => block.text));
		expect(after.every((block) => BLOCK_ID_PATTERN.test(block.id))).toBe(true);
		expect(new Set(after.map((block) => block.id)).size).toBe(after.length);
		const kept = new Set(before.map((block) => block.id));
		expect(after.some((block) => kept.has(block.id))).toBe(false);
		// The content is the same: only ids changed.
		expect(withoutBlockIds(copy.content)).toEqual(withoutBlockIds(original.content));
		// The original is not touched.
		expect(blocks(original)).toEqual(before);
	});
});
