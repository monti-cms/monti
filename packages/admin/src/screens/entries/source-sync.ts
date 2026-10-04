import { type RefObject, useEffect } from "react";

/** Vertical position of a block on screen (viewport-relative). */
export interface BlockBox {
	readonly top: number;
	readonly bottom: number;
}

/** Marker name attached to the block under the cursor in the source pane. */
export const ACTIVE_BLOCK_CLASS = "cms-source-active";

/**
 * Translation editor block -> source block order. Pairs blocks of the same kind from the top using the longest common subsequence.
 * An unpaired block (e.g. when translation splits a list in two) attaches to the previous pair's source block, so later blocks do not shift.
 */
export function alignBlocks(editorKinds: readonly string[], paneKinds: readonly string[]): number[] {
	const n = editorKinds.length;
	const m = paneKinds.length;
	if (m === 0) return [];
	// rest[i][j]: length of the longest common subsequence of editor[i..] and pane[j..].
	const rest = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
	for (let i = n - 1; i >= 0; i--) {
		const row = rest[i] as Uint16Array;
		const below = rest[i + 1] as Uint16Array;
		for (let j = m - 1; j >= 0; j--) {
			row[j] =
				editorKinds[i] === paneKinds[j]
					? (below[j + 1] as number) + 1
					: Math.max(below[j] as number, row[j + 1] as number);
		}
	}
	const matched: Array<number | null> = new Array(n).fill(null);
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		const here = (rest[i] as Uint16Array)[j] as number;
		if (editorKinds[i] === paneKinds[j] && here === ((rest[i + 1] as Uint16Array)[j + 1] as number) + 1) {
			matched[i] = j;
			i += 1;
			j += 1;
		} else if (((rest[i + 1] as Uint16Array)[j] as number) >= ((rest[i] as Uint16Array)[j + 1] as number)) i += 1;
		else j += 1;
	}
	const firstMatch = matched.find((value) => value !== null) ?? null;
	let previous: number | null = null;
	return matched.map((value, index) => {
		if (value !== null) previous = value;
		return value ?? previous ?? firstMatch ?? Math.min(index, m - 1);
	});
}

/**
 * The scrollTop that puts the same block as the one at the translation editor's baseline (just below the toolbar) at the source pane's baseline.
 * Blocks correspond through `map` (editor order -> source order). If absent, the same order (the last block if the source is shorter).
 * If the baseline is above the first block (title area), keep that gap and align the first block position. `null` if there is no block to align.
 */
export function syncOffset({
	editorBlocks,
	editorLine,
	paneBlocks,
	paneLine,
	paneScrollTop,
	map,
}: {
	editorBlocks: readonly BlockBox[];
	editorLine: number;
	paneBlocks: readonly BlockBox[];
	paneLine: number;
	paneScrollTop: number;
	map?: readonly number[];
}): number | null {
	const first = editorBlocks[0];
	const paneFirst = paneBlocks[0];
	if (!first || !paneFirst) return null;

	let paneY: number;
	if (editorLine < first.top) {
		paneY = paneFirst.top - (first.top - editorLine);
	} else {
		const found = editorBlocks.findIndex((box) => box.bottom > editorLine);
		const index = found === -1 ? editorBlocks.length - 1 : found;
		const box = editorBlocks[index] ?? first;
		const height = box.bottom - box.top;
		const fraction = height > 0 ? Math.min(1, Math.max(0, (editorLine - box.top) / height)) : 0;
		const target = paneBlocks[Math.min(map?.[index] ?? index, paneBlocks.length - 1)] ?? paneFirst;
		paneY = target.top + fraction * (target.bottom - target.top);
	}
	return Math.max(0, paneScrollTop + paneY - paneLine);
}

/** Top-level blocks, excluding placeholders ProseMirror adds (cursor, separator elements). */
const isBlock = (element: Element) =>
	!element.matches(".ProseMirror-gapcursor, .ProseMirror-separator, .ProseMirror-trailingBreak, br");

export const blocksOf = (root: Element | null | undefined): HTMLElement[] =>
	root ? (Array.from(root.children).filter(isBlock) as HTMLElement[]) : [];

const boxOf = (element: Element): BlockBox => {
	const rect = element.getBoundingClientRect();
	return { top: rect.top, bottom: rect.bottom };
};

/** Order of the top-level block containing `node`. `null` if outside the editor. */
export const blockIndexOf = (root: Element, node: Node | null): number | null => {
	if (!node || !root.contains(node) || node === root) return null;
	const blocks = blocksOf(root);
	const index = blocks.findIndex((block) => block.contains(node));
	return index === -1 ? null : index;
};

/** Block kind. For React node views, the node name (`node-cmsCallout`); otherwise the tag name. */
export const blockKind = (element: Element): string =>
	element.classList.contains("react-renderer")
		? (Array.from(element.classList).find((name) => name.startsWith("node-")) ?? "view")
		: element.tagName;

const isList = (element: Element) => element.tagName === "UL" || element.tagName === "OL";
const itemsOf = (list: Element) => Array.from(list.children).filter((child) => child.tagName === "LI");

/** Order of the list item containing `node` (from the outermost list). Empty array if outside a list. */
export function itemPathOf(block: Element, node: Node): number[] {
	const path: number[] = [];
	let current: Element | null = node instanceof Element ? node : node.parentElement;
	while (current && current !== block) {
		const parent: Element | null = current.parentElement;
		if (current.tagName === "LI" && parent && isList(parent)) path.unshift(itemsOf(parent).indexOf(current));
		current = parent;
	}
	return block.contains(node) ? path : [];
}

/** The list item at the same order in the source block. If none, as far as found (the block itself). */
export function itemAt(block: Element, path: readonly number[]): Element {
	let current = block;
	for (const index of path) {
		const list = isList(current) ? current : Array.from(current.children).find(isList);
		const item = list ? itemsOf(list)[index] : undefined;
		if (!item) break;
		current = item;
	}
	return current;
}

const PANE_RETRY_FRAMES = 30;

/**
 * Links the translation editor and the source pane. When the editor scrolls, moves the source pane so the same block is at the same height
 * (the reverse direction is not linked), and marks the source block matching the block under the editor cursor. Lists are marked per item.
 */
export function useSourceSync({
	enabled,
	syncScroll,
	editorRef,
	paneRef,
}: {
	enabled: boolean;
	syncScroll: boolean;
	editorRef: RefObject<HTMLElement | null>;
	paneRef: RefObject<HTMLElement | null>;
}) {
	useEffect(() => {
		if (!enabled) return;
		let frame = 0;
		let retries = 0;

		const panePM = () => paneRef.current?.querySelector(".ProseMirror") ?? null;
		const editorPM = () => editorRef.current?.querySelector(".ProseMirror") ?? null;

		// Re-pair only when block kinds change (not computed on every scroll).
		let alignedKey = "";
		let aligned: number[] = [];
		const alignmentOf = (editorBlocks: readonly Element[], paneBlocks: readonly Element[]) => {
			const editorKinds = editorBlocks.map(blockKind);
			const paneKinds = paneBlocks.map(blockKind);
			const key = `${editorKinds.join(",")}|${paneKinds.join(",")}`;
			if (key !== alignedKey) {
				alignedKey = key;
				aligned = alignBlocks(editorKinds, paneKinds);
			}
			return aligned;
		};

		const scrollPane = () => {
			const editorEl = editorRef.current;
			const pane = paneRef.current;
			if (!syncScroll || !editorEl || !pane) return;
			const editorBlocks = blocksOf(editorPM());
			const paneBlocks = blocksOf(panePM());
			const toolbar = editorEl.querySelector('[role="toolbar"]');
			const header = pane.querySelector("[data-source-header]");
			const next = syncOffset({
				editorBlocks: editorBlocks.map(boxOf),
				editorLine: editorEl.getBoundingClientRect().top + (toolbar?.getBoundingClientRect().height ?? 0),
				paneBlocks: paneBlocks.map(boxOf),
				paneLine: pane.getBoundingClientRect().top + (header?.getBoundingClientRect().height ?? 0),
				paneScrollTop: pane.scrollTop,
				map: alignmentOf(editorBlocks, paneBlocks),
			});
			if (next !== null && Math.abs(next - pane.scrollTop) >= 1) pane.scrollTop = next;
		};

		const markActive = () => {
			const root = editorPM();
			if (!root) return;
			const anchor = document.getSelection()?.anchorNode ?? null;
			const index = blockIndexOf(root, anchor);
			// If the cursor is outside the editor (title input, etc.), leave the marker as is.
			if (index === null || !anchor) return;
			const editorBlocks = blocksOf(root);
			const paneBlocks = blocksOf(panePM());
			const paneBlock = paneBlocks[alignmentOf(editorBlocks, paneBlocks)[index] ?? -1];
			const editorBlock = editorBlocks[index];
			const active = paneBlock && editorBlock ? itemAt(paneBlock, itemPathOf(editorBlock, anchor)) : null;
			for (const marked of Array.from(panePM()?.querySelectorAll(`.${ACTIVE_BLOCK_CLASS}`) ?? [])) {
				if (marked !== active) marked.classList.remove(ACTIVE_BLOCK_CLASS);
			}
			active?.classList.add(ACTIVE_BLOCK_CLASS);
		};

		const run = () => {
			frame = 0;
			scrollPane();
			markActive();
		};
		const schedule = () => {
			if (frame === 0) frame = requestAnimationFrame(run);
		};

		// The source pane's editor is created late. Wait briefly until blocks exist, then align once at first.
		const waitForPane = () => {
			frame = 0;
			if (blocksOf(panePM()).length > 0 || retries >= PANE_RETRY_FRAMES) {
				run();
				return;
			}
			retries += 1;
			frame = requestAnimationFrame(waitForPane);
		};
		frame = requestAnimationFrame(waitForPane);

		const editorEl = editorRef.current;
		editorEl?.addEventListener("scroll", schedule, { passive: true });
		document.addEventListener("selectionchange", schedule);
		return () => {
			if (frame) cancelAnimationFrame(frame);
			editorEl?.removeEventListener("scroll", schedule);
			document.removeEventListener("selectionchange", schedule);
		};
	}, [enabled, syncScroll, editorRef, paneRef]);
}
