import type { Node as PmNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { CONTAINER_NODE_NAMES, PARENT_ONLY_NODE_NAMES } from "../blocks/added/shared";

/**
 * 블록 요소 해석 규약 및 DOM 탐색(v2 C1).
 * 최상위 블록, 중첩 블록(목록 항목, 인용구 내부), NodeView 컨테이너(content hole)를 공통 규약으로 다룬다.
 */

/**
 * 자식 블록을 하나씩 옮길 수 있는 컨테이너 노드 이름. 인용과 더한 컨테이너 블록(콜아웃·접기·탭·단 등)이다.
 * 이 목록에 없는 부모(표 셀 등)의 자식은 따로 옮기지 않고 부모 블록 단위로 옮긴다.
 */
export const DRAG_CONTAINER_NODES = new Set<string>(["blockquote", ...CONTAINER_NODE_NAMES]);

const isContentHole = (element: HTMLElement | null) =>
	!!element &&
	(element.hasAttribute("data-node-view-content") ||
		element.hasAttribute("data-node-view-content-react") ||
		element.classList.contains("ProseMirror-content"));

const isListElement = (element: HTMLElement) =>
	element.tagName === "UL" || element.tagName === "OL" || element.getAttribute("data-type") === "taskList";

const isListItemElement = (element: HTMLElement) =>
	element.tagName === "LI" || element.getAttribute("data-type") === "taskItem";

/**
 * 안으로 내려가지 않는 NodeView(코드 블록). contentDOM 안이 블록이 아니라 글자 조각이라, 내려가면 코드 줄마다
 * 핸들이 뜬다. 블록 전체를 한 대상으로 본다.
 */
const LEAF_VIEW_SELECTOR = ".node-codeBlock";

/** 자식 블록을 따로 옮길 수 없는 틀(단 하나·탭 하나). 핸들 대상이 되지 않는다. */
const STRUCTURAL_VIEWS = [...PARENT_ONLY_NODE_NAMES].map((name) => `node-${name}`);
const isStructural = (element: HTMLElement) => STRUCTURAL_VIEWS.some((name) => element.classList.contains(name));

/** NodeView(컨테이너)의 contentDOM. 안쪽 컨테이너의 것은 건너뛴다. */
const contentHoleOf = (view: HTMLElement): HTMLElement | null =>
	Array.from(view.querySelectorAll<HTMLElement>("[data-node-view-content-react]")).find(
		(hole) => hole.closest(".react-renderer") === view,
	) ?? null;

/** 줄을 더 잘게 나눌 수 있는 블록의 자식 블록들. 더 나눌 수 없으면 null이다. */
const childBlocksOf = (element: HTMLElement): HTMLElement[] | null => {
	const children = (parent: Element) =>
		Array.from(parent.children).filter(
			(child): child is HTMLElement => child instanceof HTMLElement && child.getBoundingClientRect().height > 0,
		);
	if (isListElement(element)) return children(element).filter(isListItemElement);
	// 목록 항목은 들여쓴 목록만 따로 나눈다(항목의 문단은 항목과 같은 대상이다).
	if (isListItemElement(element)) return children(element).filter(isListElement);
	if (element.matches(LEAF_VIEW_SELECTOR)) return null;
	if (element.classList.contains("react-renderer")) {
		const hole = contentHoleOf(element);
		return hole ? children(hole) : null;
	}
	return null;
};

const verticalGap = (child: HTMLElement, clientY: number) => {
	const rect = child.getBoundingClientRect();
	return clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
};

/**
 * 그 줄(clientY)에 걸친 자식. 나란히 놓인 자식(단)은 clientX로 고르고, 틈이면 가까운 쪽이다.
 * `nearestRow`면 어느 자식에도 걸치지 않는 줄(목록 항목 사이 여백)도 가장 가까운 자식을 고른다.
 */
const childAt = (children: HTMLElement[], clientX: number, clientY: number, nearestRow = false): HTMLElement | null => {
	const rows = children.filter((child) => verticalGap(child, clientY) === 0);
	if (rows.length === 0 && nearestRow && children.length > 0)
		return children.reduce((nearest, child) =>
			verticalGap(child, clientY) < verticalGap(nearest, clientY) ? child : nearest,
		);
	if (rows.length <= 1) return rows[0] ?? null;
	const gap = (child: HTMLElement) => {
		const rect = child.getBoundingClientRect();
		return clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
	};
	return rows.reduce((nearest, child) => (gap(child) < gap(nearest) ? child : nearest));
};

/**
 * 한 줄에 핸들을 하나만 두도록, 가리킨 블록을 그 줄의 가장 안쪽 블록으로 좁힌다.
 * - 목록(들여쓰기·글머리표 자리)은 그 높이의 항목으로, 들여쓴 목록이면 그 안쪽 항목까지 내려간다.
 * - 컨테이너(콜아웃·접기·탭·단)의 틀·여백은 그 높이의 안쪽 블록으로 내려간다. 안쪽 블록이 없는 줄
 *   (제목 줄·위아래 여백)일 때만 컨테이너 자신이 대상이다.
 * - 단 하나·탭 하나는 대상이 아니다. 안쪽 블록이 없는 줄이면 바깥 컨테이너(단 나누기·탭)를 잡는다.
 * 그러지 않으면 마우스가 틀과 글자를 오갈 때 같은 줄의 핸들이 두 위치로 번갈아 뜬다.
 */
export function refineBlock(block: HTMLElement, clientX: number, clientY: number): HTMLElement {
	let current = block;
	for (let depth = 0; depth < 32; depth += 1) {
		const children = childBlocksOf(current);
		// 목록에는 제목 줄이 없다. 항목 사이 여백도 가까운 항목을 잡는다(목록 전체 핸들이 첫 항목 줄에 뜨지 않게).
		const hit = children ? childAt(children, clientX, clientY, isListElement(current)) : null;
		if (hit) {
			current = hit;
			continue;
		}
		if (isStructural(current)) {
			const parent = current.parentElement?.closest<HTMLElement>(".react-renderer");
			if (parent) return parent;
		}
		return current;
	}
	return current;
}

export interface TargetBlock {
	node: PmNode;
	start: number;
	end: number;
	depth: number;
	index: number;
	parent: PmNode;
}

/**
 * 주어진 DOM 엘리먼트로부터 핸들이 부착될 블록 수준 DOM 엘리먼트를 찾는다.
 * - 최상위 블록: 에디터 root의 직계 자식
 * - 목록 항목: <li> 및 [data-type="taskItem"]
 * - 인용문: 안쪽을 가리켜도 인용문 전체
 * - 컨테이너 NodeView 내부: [data-node-view-content] (content hole)의 직계 자식 블록
 * - 컨테이너 NodeView 자체: contentDOM 외부의 헤더/패딩 등에 호버할 때
 */
export function findBlockDOM(root: HTMLElement, target: HTMLElement | null): HTMLElement | null {
	if (!target || !root.contains(target) || target === root) return null;

	// 인용문은 한 덩어리로 옮긴다. 안쪽 문단에 핸들을 두면 인용문 왼쪽 줄과 겹치고, 같은 줄에 핸들이 둘이 된다.
	const quote = target.closest("blockquote");
	const leaf = target.closest<HTMLElement>(LEAF_VIEW_SELECTOR);
	let current: HTMLElement | null = quote && root.contains(quote) ? quote : leaf && root.contains(leaf) ? leaf : target;

	while (current && current !== root) {
		const parent: HTMLElement | null = current.parentElement;
		if (!parent) break;

		// 1. 에디터 root의 직계 자식이면 최상위 블록
		if (parent === root) {
			return current;
		}

		// 2. 목록 항목 (ul/ol 아래의 li)
		if (current.tagName === "LI" || current.getAttribute("data-type") === "taskItem") {
			return current;
		}

		// 4. 컨테이너 NodeView의 content hole 직계 자식 블록. Tiptap React는 `data-node-view-content` 안에
		// 실제 contentDOM(`data-node-view-content-react`)을 한 겹 더 두므로 둘 다 content hole로 본다.
		if (isContentHole(parent)) {
			return current;
		}

		// 5. 컨테이너 NodeView의 래퍼(data-node-view-wrapper) 직계 영역 (헤더/배경 등)
		if (parent.hasAttribute("data-node-view-wrapper")) {
			if (!current.hasAttribute("data-node-view-content")) {
				let wrapper: HTMLElement | null = parent;
				while (wrapper && wrapper.parentElement !== root && !isContentHole(wrapper.parentElement)) {
					wrapper = wrapper.parentElement;
				}
				if (wrapper) return wrapper;
			}
		}

		current = parent;
	}

	return current !== root ? current : null;
}

/**
 * 문서 위치가 가리키는 이동 대상 블록을 찾는다.
 * - 목록 항목(listItem / taskItem): depth를 listItem 레벨로 맞춰 항목 전체를 이동 단위로 삼는다.
 * - 인용구 / 컨테이너 내부 블록: 자식 블록 단위로 이동한다.
 * - 최상위 블록: depth 1 블록 단위로 이동한다.
 */
export function targetBlockAt(doc: PmNode, pos: number): TargetBlock | null {
	if (doc.childCount === 0) return null;
	const safePos = Math.max(0, Math.min(pos, doc.content.size));
	const $pos = doc.resolve(safePos);

	// 블록 바로 앞 위치(원자 블록의 posAtDOM, 블록 전체 선택, 핸들 메뉴가 넘기는 블록 시작)면 그 블록이 대상이다.
	// 목록 항목 안의 블록은 항목이 이동 단위다(아래 1번).
	const after = $pos.nodeAfter;
	const inListItem = $pos.parent.type.name === "listItem" || $pos.parent.type.name === "taskItem";
	if (after?.isBlock && !inListItem) {
		return {
			node: after,
			start: safePos,
			end: safePos + after.nodeSize,
			depth: $pos.depth + 1,
			index: $pos.index(),
			parent: $pos.parent,
		};
	}

	if ($pos.depth === 0) {
		// 문서 끝 등 블록 사이: 가장 가까운 최상위 블록.
		const index = Math.min($pos.index(0), doc.childCount - 1);
		let start = 0;
		for (let i = 0; i < index; i++) start += doc.child(i).nodeSize;
		const node = doc.child(index);
		return { node, start, end: start + node.nodeSize, depth: 1, index, parent: doc };
	}

	// 1. 목록 항목 확인 (listItem, taskItem)
	for (let d = $pos.depth; d >= 1; d--) {
		const n = $pos.node(d);
		if (n.type.name === "listItem" || n.type.name === "taskItem") {
			const start = $pos.before(d);
			return {
				node: n,
				start,
				end: $pos.after(d),
				depth: d,
				index: $pos.index(d - 1),
				parent: $pos.node(d - 1),
			};
		}
	}

	// 2. 인용문 또는 컨테이너 내부 블록 확인
	for (let d = $pos.depth; d >= 1; d--) {
		const n = $pos.node(d);
		const parent = $pos.node(d - 1);
		if (n.isBlock && parent && DRAG_CONTAINER_NODES.has(parent.type.name)) {
			const start = $pos.before(d);
			return {
				node: n,
				start,
				end: $pos.after(d),
				depth: d,
				index: $pos.index(d - 1),
				parent,
			};
		}
	}

	// 3. 최상위 블록 (depth 1)
	const d = 1;
	const node = $pos.node(d);
	if (node) {
		const start = $pos.before(d);
		return {
			node,
			start,
			end: $pos.after(d),
			depth: d,
			index: $pos.index(0),
			parent: doc,
		};
	}

	return null;
}

/**
 * 찾은 블록 DOM 엘리먼트로부터 ProseMirror 위치 및 블록 정보를 계산한다.
 */
export function resolveTargetBlock(
	view: EditorView,
	blockEl: HTMLElement,
): { pos: number; node: PmNode; rect: DOMRect } | null {
	try {
		const pos = view.posAtDOM(blockEl, 0);
		const rect = blockEl.getBoundingClientRect();

		// 이 DOM이 바로 그리는 노드를 찾는다. NodeView(컨테이너·단 하나)는 posAtDOM이 안쪽 첫 자식을 가리켜
		// 핸들은 컨테이너 옆인데 첫 블록만 옮겨지는 어긋남이 생긴다.
		const $pos = view.state.doc.resolve(pos);
		for (let depth = $pos.depth; depth >= 1; depth -= 1) {
			const start = $pos.before(depth);
			if (view.nodeDOM(start) === blockEl) return { pos: start, node: $pos.node(depth), rect };
		}
		if ($pos.nodeAfter && view.nodeDOM(pos) === blockEl) return { pos, node: $pos.nodeAfter, rect };

		const target = targetBlockAt(view.state.doc, pos);
		if (target) {
			return { pos: target.start, node: target.node, rect };
		}

		return null;
	} catch {
		return null;
	}
}
