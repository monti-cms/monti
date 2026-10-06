import { describe, expect, it } from "vitest";
import { docOf } from "../../../../test/stored-content";
import { BLOCKS } from "../../../blocks/active";
import type { BlockDefinition } from "../../../blocks/define";
import { assignBlockIds, withoutBlockIds } from "../../../doc/block-ids";
import { STORED_DOCUMENT_VERSION, type StoredDocument, unparsedDocument } from "../../../doc/stored-document";
import type { CmsNode } from "../../../doc/types";
import { diffSources, type SourceChange, type TranslationUnit } from "../source-diff";

/**
 * Block names are looked up in the current config (runs with both the reference blog config and other site configs). If the config has no such block,
 * that case is skipped (e.g. other site configs have no expandable titled box or tab group).
 */
const translatableOf = (block: BlockDefinition | undefined) =>
	block && Object.entries(block.attributes).find(([, attribute]) => attribute.translatable)?.[0];
/** A titled box compared by expanding it (e.g. callout). Alignment is a core block, so any config has it. */
const titledBox = BLOCKS.find(
	(block) =>
		block.syntax.kind === "container" &&
		block.translateInside &&
		!block.children?.blocks &&
		!block.parent &&
		translatableOf(block),
);
const titleAttribute = translatableOf(titledBox);
/** That box's non-translated text attribute (if any, e.g. callout kind) and the value to put in. */
const otherAttribute = titledBox
	? Object.entries(titledBox.attributes)
			.filter(([name, attribute]) => attribute.type === "string" && name !== titleAttribute)
			.map(([name, attribute]) => [name, attribute.options ? Object.keys(attribute.options)[0] : "x"] as const)[0]
	: undefined;

/** A document of the titled box with the given title and one paragraph in it (and a paragraph before it). */
const titled = (title: string, body: string, previous?: StoredDocument | null): StoredDocument =>
	documentOf(
		[
			paragraph("앞"),
			{
				type: titledBox?.name ?? "",
				attrs: { ...(otherAttribute ? { [otherAttribute[0]]: otherAttribute[1] } : {}), [titleAttribute ?? ""]: title },
				content: [paragraph(body)],
			},
		],
		previous,
	);
/** An expandable group that gathers children's translatable attributes (e.g. tab names) into one header line (e.g. tab group). */
const labeledGroup = BLOCKS.flatMap((block) => {
	const child = BLOCKS.find((candidate) => candidate.name === block.children?.blocks?.[0]);
	const label = translatableOf(child);
	return block.translateInside && child && label ? [{ block, child, label }] : [];
})[0];

const inlineText = (node: CmsNode): string => node.text ?? (node.content ?? []).map(inlineText).join("");

/** A block as text: its words, a heading with its `#` marks. */
const blockText = (node: CmsNode) =>
	node.type === "heading" ? `${"#".repeat(Number(node.attrs?.level ?? 1))} ${inlineText(node)}` : inlineText(node);

/** A unit as text: a header line as its JSON, a block as its words. */
const text = (unit: TranslationUnit) => (unit.kind === "header" ? unit.source : blockText(unit.node));

/** A document of the given blocks, with ids drawn for blocks that have none and inherited from `previous` where they pair. */
const documentOf = (content: CmsNode[], previous?: StoredDocument | null): StoredDocument => ({
	type: "doc",
	version: STORED_DOCUMENT_VERSION,
	content: assignBlockIds(content, [previous?.content]),
});

const paragraph = (value: string): CmsNode => ({ type: "paragraph", content: [{ type: "text", text: value }] });

/** An expandable alignment box (a core block, so any config has it) around paragraphs. */
const alignBox = (align: string, ...inner: string[]): CmsNode => ({
	type: "text-align",
	attrs: { align },
	content: inner.map(paragraph),
});

/** The blocks of two bodies written as text compared (each read as a document of its own, so only kind and content pair the blocks). */
const diffText = (before: string, after: string) => diffSources(docOf(before), docOf(after));

const summary = (changes: SourceChange[] | null) =>
	changes?.map((change) =>
		change.kind === "changed"
			? ["changed", text(change.before), text(change.after)]
			: change.kind === "moved"
				? [change.edited ? "moved+edited" : "moved", text(change.before), text(change.after)]
				: change.kind === "added"
					? ["added", text(change.after)]
					: ["removed", text(change.before)],
	);

describe("comparing two source versions", () => {
	it("nothing changed when equal", () => {
		expect(diffText("하나\n\n둘\n", "하나\n\n둘\n")).toEqual([]);
	});

	it("finds changed, added and removed blocks in document order", () => {
		expect(summary(diffText("하나\n\n둘\n\n셋\n\n넷\n", "하나 고침\n\n둘\n\n새 문단\n\n넷\n\n## 새 제목\n"))).toEqual([
			["changed", "하나", "하나 고침"],
			["changed", "셋", "새 문단"],
			["added", "## 새 제목"],
		]);
		expect(summary(diffText("하나\n\n둘\n\n셋\n", "하나\n\n셋\n"))).toEqual([["removed", "둘"]]);
	});

	it("blocks inside a box are compared separately", () => {
		const before = documentOf([alignBox("center", "안쪽", "그대로")]);
		const after = documentOf([alignBox("center", "안쪽 고침", "그대로")]);
		expect(summary(diffSources(before, after))).toEqual([["changed", "안쪽", "안쪽 고침"]]);
	});

	it.skipIf(!titledBox || !titleAttribute)("blocks and the title inside a box are compared separately", () => {
		if (!titledBox || !titleAttribute) return;
		expect(summary(diffSources(titled("알림", "안쪽"), titled("주의", "안쪽 고침")))).toEqual([
			["changed", JSON.stringify({ title: "알림" }), JSON.stringify({ title: "주의" })],
			["changed", "안쪽", "안쪽 고침"],
		]);
	});

	it.skipIf(!labeledGroup)("tab names are gathered into one tab group header line for comparison", () => {
		if (!labeledGroup) return;
		const { block, child, label } = labeledGroup;
		const tabs = (second: string) =>
			documentOf([
				{
					type: block.name,
					content: [
						{ type: child.name, attrs: { [label]: "하나" }, content: [paragraph("첫째")] },
						{ type: child.name, attrs: { [label]: second }, content: [paragraph("둘째")] },
					],
				},
			]);
		expect(summary(diffSources(tabs("둘"), tabs("둘 고침")))).toEqual([
			["changed", JSON.stringify({ labels: ["하나", "둘"] }), JSON.stringify({ labels: ["하나", "둘 고침"] })],
		]);
	});

	it("null when either body is unparsed", () => {
		expect(diffSources(unparsedDocument("본문 <TextAlign>닫히지 않음"), docOf("하나"))).toBeNull();
		expect(diffSources(docOf("하나"), unparsedDocument("본문 <TextAlign>닫히지 않음"))).toBeNull();
	});
});

/** The words of a document's blocks, one block per line pair. */
const wordsOf = (doc: StoredDocument) => doc.content.map(blockText).join("\n\n");

/** A version of a body as the translation screen sees it: its words and its document, whose block ids are inherited from `previous`. */
const version = (words: string, previous?: StoredDocument | null) => ({
	mdx: words.trim(),
	doc: docOf(words, previous),
});

/** A version of a document built by hand (a box), whose block ids are inherited from `previous`. */
const versionOf = (content: CmsNode[], previous?: StoredDocument | null) => {
	const doc = documentOf(content, previous);
	return { mdx: wordsOf(doc), doc };
};

type Version = ReturnType<typeof version>;

const compare = (before: Version, after: Version) => diffSources(before.doc, after.doc);

/** The same version with its blocks in another order (ids move with them) and optionally edited text. */
const reorder = (from: Version, order: number[], edits: Record<number, string> = {}): Version => {
	const content = order.map((index) => {
		const block = from.doc.content[index];
		if (!block) throw new Error("fixture");
		const text = edits[index];
		return text === undefined ? block : { ...block, content: [{ type: "text", text }] };
	});
	const doc = { ...from.doc, content };
	return { mdx: wordsOf(doc), doc };
};

const withoutIds = (from: Version): Version => ({
	mdx: from.mdx,
	doc: { ...from.doc, content: withoutBlockIds(from.doc.content) } as StoredDocument,
});

describe("comparing two source versions by block id", () => {
	const base = version("가\n\n나\n\n다\n\n라\n");

	it("nothing changed when equal", () => {
		expect(compare(base, version(base.mdx, base.doc))).toEqual([]);
	});

	it("an edited block stays the same block", () => {
		const after = version("가\n\n나 고침\n\n다\n\n라\n", base.doc);
		expect(summary(compare(base, after))).toEqual([["changed", "나", "나 고침"]]);
	});

	it("finds an added and a removed block", () => {
		expect(summary(compare(base, version("가\n\n나\n\n새 문단\n\n다\n\n라\n", base.doc)))).toEqual([
			["added", "새 문단"],
		]);
		expect(summary(compare(base, version("가\n\n다\n\n라\n", base.doc)))).toEqual([["removed", "나"]]);
		// Apart from each other, so not taken for one edited block.
		expect(summary(compare(base, version("가\n\n다\n\n라\n\n마\n", base.doc)))).toEqual([
			["removed", "나"],
			["added", "마"],
		]);
	});

	it("lists a removed block after the block that preceded it", () => {
		const after = reorder(base, [0, 2, 3], { 2: "다 고침" });
		expect(summary(compare(base, after))).toEqual([
			["removed", "나"],
			["changed", "다", "다 고침"],
		]);
		expect(summary(compare(base, version("나\n\n다\n\n라\n", base.doc)))).toEqual([["removed", "가"]]);
	});

	it("a block that moved is moved, not removed and added", () => {
		const after = reorder(base, [3, 0, 1, 2]);
		expect(after.mdx).toBe("라\n\n가\n\n나\n\n다");
		expect(summary(compare(base, after))).toEqual([["moved", "라", "라"]]);
		expect(summary(compare(base, reorder(base, [1, 2, 3, 0])))).toEqual([["moved", "가", "가"]]);
	});

	it("reports as few moved blocks as the new order needs", () => {
		// Reversed: only one block can stay.
		expect(compare(base, reorder(base, [3, 2, 1, 0]))?.map((change) => change.kind)).toEqual([
			"moved",
			"moved",
			"moved",
		]);
		// Two adjacent blocks swapped: one of them moved.
		expect(compare(base, reorder(base, [0, 2, 1, 3]))?.map((change) => change.kind)).toEqual(["moved"]);
	});

	it("a block that moved and was edited is moved and edited", () => {
		const after = reorder(base, [3, 0, 1, 2], { 3: "라 고침" });
		expect(summary(compare(base, after))).toEqual([["moved+edited", "라", "라 고침"]]);
	});

	it("a move does not hide an edit or an added block elsewhere", () => {
		const moved = reorder(base, [3, 0, 1, 2], { 1: "나 고침" });
		const after = version(`${moved.mdx}\n\n마`, moved.doc);
		expect(summary(compare(base, after))).toEqual([
			["moved", "라", "라"],
			["changed", "나", "나 고침"],
			["added", "마"],
		]);
	});

	it("blocks inside a box are paired by id and moved inside it", () => {
		const box = versionOf([alignBox("center", "안쪽 하나", "안쪽 둘"), paragraph("바깥")]);
		const inside = box.doc.content[0];
		if (!inside?.content) throw new Error("fixture");
		const swapped = {
			...box.doc,
			content: [{ ...inside, content: [...inside.content].reverse() }, ...box.doc.content.slice(1)],
		};
		const after = { mdx: wordsOf(swapped), doc: swapped };
		expect(compare(box, after)?.map((change) => change.kind)).toEqual(["moved"]);
		const edited = versionOf([alignBox("center", "안쪽 하나", "안쪽 둘 고침"), paragraph("바깥")], box.doc);
		expect(summary(compare(box, edited))).toEqual([["changed", "안쪽 둘", "안쪽 둘 고침"]]);
	});

	it("a block moved into another box is moved though its position among the blocks is the same", () => {
		const before = versionOf([alignBox("center", "하나"), alignBox("right", "둘")]);
		const [left, right] = before.doc.content;
		const one = left?.content?.[0];
		if (!left || !right || !one) throw new Error("fixture");
		const doc = {
			...before.doc,
			content: [
				{ ...left, content: [] },
				{ ...right, content: [one, ...(right.content ?? [])] },
			],
		};
		const after = { mdx: wordsOf(doc as StoredDocument), doc } as Version;
		expect(summary(compare(before, after))).toEqual([["moved", "하나", "하나"]]);
	});

	it.skipIf(!titledBox || !titleAttribute)("the title of a box is paired by the box's id", () => {
		if (!titledBox || !titleAttribute) return;
		const before = { mdx: "", doc: titled("알림", "안쪽") };
		const after = { mdx: "", doc: titled("주의", "안쪽 고침", before.doc) };
		expect(summary(compare(before, after))).toEqual([
			["changed", JSON.stringify({ title: "알림" }), JSON.stringify({ title: "주의" })],
			["changed", "안쪽", "안쪽 고침"],
		]);
	});

	it("blocks without an id are paired by kind and content as before", () => {
		const before = withoutIds(base);
		const after = withoutIds(version("가\n\n나 고침\n\n다\n\n마\n"));
		expect(summary(compare(before, after))).toEqual(summary(diffText(before.mdx, after.mdx)));
		expect(summary(compare(before, after))).toEqual([
			["changed", "나", "나 고침"],
			["changed", "라", "마"],
		]);
		// A move without ids is a removal and an addition.
		expect(summary(compare(withoutIds(base), withoutIds(reorder(base, [3, 0, 1, 2]))))).toEqual([
			["added", "라"],
			["removed", "라"],
		]);
	});

	it("a block with an id and one without are each paired their own way", () => {
		const after = version("가\n\n나 고침\n\n다\n\n라\n", base.doc);
		const [first, second, ...rest] = after.doc.content;
		if (!first || !second) throw new Error("fixture");
		const [bare] = withoutBlockIds([second]);
		const mixed = { mdx: after.mdx, doc: { ...after.doc, content: [first, bare, ...rest] } as StoredDocument };
		expect(summary(compare(base, mixed))).toEqual([["changed", "나", "나 고침"]]);
		// A repeated id pairs only once; the copy is paired by kind and content like a block without an id.
		const repeated = {
			mdx: after.mdx,
			doc: { ...after.doc, content: [first, { ...first }, ...rest] } as StoredDocument,
		};
		expect(summary(compare(base, repeated))).toEqual([["changed", "나", "가"]]);
	});

	it("compares nothing when either body is unparsed", () => {
		const unparsed = { mdx: "<Box", doc: unparsedDocument("<Box") };
		expect(compare(base, unparsed)).toBeNull();
		expect(compare(unparsed, base)).toBeNull();
	});
});
