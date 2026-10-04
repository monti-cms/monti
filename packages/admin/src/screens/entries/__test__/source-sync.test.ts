import { describe, expect, it } from "vitest";
import { alignBlocks, blockIndexOf, blocksOf, itemAt, itemPathOf, syncOffset } from "../source-sync";

const boxes = (...tops: number[]) => tops.map((top, i) => ({ top, bottom: tops[i + 1] ?? top + 100 }));

describe("syncOffset", () => {
	// Editor blocks: 100-200, 200-400, 400-500 / source blocks: 300-350, 350-450, 450-550
	const editorBlocks = [
		{ top: 100, bottom: 200 },
		{ top: 200, bottom: 400 },
		{ top: 400, bottom: 500 },
	];
	const paneBlocks = [
		{ top: 300, bottom: 350 },
		{ top: 350, bottom: 450 },
		{ top: 450, bottom: 550 },
	];

	it("moves so the same point of the block under the baseline lands on the source pane baseline", () => {
		// Baseline 300 is half of the second block. Half of the source's second block (400) lands on baseline 60.
		expect(syncOffset({ editorBlocks, editorLine: 300, paneBlocks, paneLine: 60, paneScrollTop: 20 })).toBe(
			20 + 400 - 60,
		);
	});

	it("with a different number of blocks, aligns to the last block", () => {
		const short = paneBlocks.slice(0, 2);
		// At the start of the third block (400-500), the source aligns to the start of its last (second) block.
		expect(syncOffset({ editorBlocks, editorLine: 400, paneBlocks: short, paneLine: 50, paneScrollTop: 0 })).toBe(
			350 - 50,
		);
	});

	it("a baseline past the end is treated as the end of the last block", () => {
		expect(syncOffset({ editorBlocks, editorLine: 900, paneBlocks, paneLine: 0, paneScrollTop: 0 })).toBe(550);
	});

	it("above the first block (title area), keeps that gap and aligns the first block position", () => {
		// Baseline is 30px above the first block: put the point 30px above the source's first block on the baseline.
		expect(syncOffset({ editorBlocks, editorLine: 70, paneBlocks, paneLine: 48, paneScrollTop: 0 })).toBe(
			300 - 30 - 48,
		);
		// Negative values are clamped to 0.
		expect(syncOffset({ editorBlocks, editorLine: 0, paneBlocks, paneLine: 300, paneScrollTop: 0 })).toBe(0);
	});

	it("returns null when there is no block to align", () => {
		expect(syncOffset({ editorBlocks: [], editorLine: 0, paneBlocks, paneLine: 0, paneScrollTop: 0 })).toBeNull();
		expect(syncOffset({ editorBlocks, editorLine: 0, paneBlocks: [], paneLine: 0, paneScrollTop: 0 })).toBeNull();
		expect(boxes(0, 10)).toHaveLength(2);
	});
});

describe("finding top-level blocks", () => {
	const root = document.createElement("div");
	root.innerHTML =
		'<p>하나<strong>굵게</strong></p><div class="ProseMirror-gapcursor"></div><ul><li>목록</li></ul><br class="ProseMirror-trailingBreak">';
	document.body.append(root);

	it("placeholder elements are not counted as blocks", () => {
		expect(blocksOf(root).map((block) => block.tagName)).toEqual(["P", "UL"]);
	});

	it("from an inner node, finds the order of the top-level block that contains it", () => {
		expect(blockIndexOf(root, root.querySelector("strong")?.firstChild ?? null)).toBe(0);
		expect(blockIndexOf(root, root.querySelector("li"))).toBe(1);
		expect(blockIndexOf(root, document.body)).toBeNull();
		expect(blockIndexOf(root, null)).toBeNull();
	});
});

describe("block pairing", () => {
	it("the same structure pairs in the same order", () => {
		expect(alignBlocks(["H2", "UL", "P"], ["H2", "UL", "P"])).toEqual([0, 1, 2]);
	});

	it("even if a list splits in two in the translation, later blocks do not shift", () => {
		// Translation: heading, list, paragraph, list, heading / source: heading, list, heading
		expect(alignBlocks(["H2", "UL", "P", "UL", "H2"], ["H2", "UL", "H2"])).toEqual([0, 1, 1, 1, 2]);
	});

	it("a block not in the source at the very start attaches to the first pair", () => {
		expect(alignBlocks(["P", "H2", "UL"], ["H2", "UL"])).toEqual([0, 0, 1]);
		expect(alignBlocks(["P"], [])).toEqual([]);
	});

	it("scrolling also aligns to the paired source block", () => {
		const editorBlocks = [
			{ top: 0, bottom: 100 },
			{ top: 100, bottom: 200 },
			{ top: 200, bottom: 300 },
		];
		const paneBlocks = [
			{ top: 0, bottom: 50 },
			{ top: 50, bottom: 100 },
		];
		// Start of the third block -> start of the source's second block (50).
		expect(
			syncOffset({ editorBlocks, editorLine: 200, paneBlocks, paneLine: 0, paneScrollTop: 0, map: [0, 0, 1] }),
		).toBe(50);
	});
});

describe("list item marking", () => {
	const make = (html: string) => {
		const root = document.createElement("div");
		root.innerHTML = html;
		return root.firstElementChild as Element;
	};

	it("finds the same source item by the editor list item's order", () => {
		const editorList = make("<ul><li><p>a</p></li><li><p>b</p><ul><li><p>c</p></li><li><p>d</p></li></ul></li></ul>");
		const paneList = make("<ul><li><p>A</p></li><li><p>B</p><ul><li><p>C</p></li><li><p>D</p></li></ul></li></ul>");
		const d = editorList.querySelectorAll("p")[3]?.firstChild as Node;
		expect(itemPathOf(editorList, d)).toEqual([1, 1]);
		expect(itemAt(paneList, [1, 1]).textContent).toBe("D");
		expect(itemAt(paneList, [0]).textContent).toBe("A");
	});

	it("if not a list or the source lacks that item, it is the block itself", () => {
		const paragraph = make("<p>글</p>");
		expect(itemPathOf(paragraph, paragraph.firstChild as Node)).toEqual([]);
		const paneList = make("<ul><li>A</li></ul>");
		expect(itemAt(paneList, [3])).toBe(paneList);
	});
});
