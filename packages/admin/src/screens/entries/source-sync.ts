import { type RefObject, useEffect } from "react";

/** 화면 위 블록의 세로 자리(뷰포트 기준). */
export interface BlockBox {
	readonly top: number;
	readonly bottom: number;
}

/** 원문 창에서 커서가 있는 블록에 붙이는 표시 이름. */
export const ACTIVE_BLOCK_CLASS = "cms-source-active";

/**
 * 번역 편집기 블록 → 원문 블록 순서. 종류가 같은 블록을 위에서부터 가장 길게 짝짓는다(최장 공통 부분열).
 * 짝이 없는 블록(번역하다 목록이 둘로 나뉜 경우 등)은 바로 앞 짝의 원문 블록에 붙어, 뒤 블록이 밀리지 않는다.
 */
export function alignBlocks(editorKinds: readonly string[], paneKinds: readonly string[]): number[] {
	const n = editorKinds.length;
	const m = paneKinds.length;
	if (m === 0) return [];
	// rest[i][j]: editor[i..]와 pane[j..]의 최장 공통 부분열 길이.
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
 * 번역 편집기의 기준선(도구줄 바로 아래)에 걸린 블록과 같은 블록이, 원문 창의 기준선에 오도록 하는 scrollTop.
 * 블록은 `map`(편집기 순서 → 원문 순서)으로 대응한다. 없으면 같은 순서다(원문이 더 짧으면 마지막 블록).
 * 기준선이 첫 블록보다 위(제목 영역)면 그 간격을 그대로 두고 첫 블록 위치를 맞춘다. 맞출 블록이 없으면 `null`.
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

/** ProseMirror가 덧붙이는 자리 표시(커서·구분 요소)를 뺀 최상위 블록. */
const isBlock = (element: Element) =>
	!element.matches(".ProseMirror-gapcursor, .ProseMirror-separator, .ProseMirror-trailingBreak, br");

export const blocksOf = (root: Element | null | undefined): HTMLElement[] =>
	root ? (Array.from(root.children).filter(isBlock) as HTMLElement[]) : [];

const boxOf = (element: Element): BlockBox => {
	const rect = element.getBoundingClientRect();
	return { top: rect.top, bottom: rect.bottom };
};

/** `node`가 든 최상위 블록의 순서. 편집기 밖이면 `null`. */
export const blockIndexOf = (root: Element, node: Node | null): number | null => {
	if (!node || !root.contains(node) || node === root) return null;
	const blocks = blocksOf(root);
	const index = blocks.findIndex((block) => block.contains(node));
	return index === -1 ? null : index;
};

/** 블록 종류. React 노드 뷰는 노드 이름(`node-cmsCallout`), 그 밖은 태그 이름이다. */
export const blockKind = (element: Element): string =>
	element.classList.contains("react-renderer")
		? (Array.from(element.classList).find((name) => name.startsWith("node-")) ?? "view")
		: element.tagName;

const isList = (element: Element) => element.tagName === "UL" || element.tagName === "OL";
const itemsOf = (list: Element) => Array.from(list.children).filter((child) => child.tagName === "LI");

/** `node`가 든 목록 항목의 순서(바깥 목록부터). 목록 밖이면 빈 배열이다. */
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

/** 원문 블록에서 같은 순서의 목록 항목. 없으면 찾은 데까지(블록 자신)다. */
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
 * 번역 편집기와 원문 창을 잇는다(v3). 편집기를 스크롤하면 같은 블록이 같은 높이에 오도록 원문 창을 옮기고
 * (반대 방향은 잇지 않는다), 편집기 커서가 있는 블록에 대응하는 원문 블록을 표시한다. 목록은 항목 단위로 표시한다.
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

		// 블록 종류가 바뀔 때만 다시 짝짓는다(스크롤마다 계산하지 않는다).
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
			// 커서가 편집기 밖(제목 입력 등)이면 표시를 그대로 둔다.
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

		// 원문 창의 편집기는 늦게 만들어진다. 블록이 생길 때까지 잠시 기다렸다가 처음 한 번 맞춘다.
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
