import type { Node as PmNode } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey, TextSelection, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { deleteBlockSet, MOVED_BLOCKS_META } from "./drag-commands";

/**
 * 블록 선택(노션의 블록 선택). 글자 선택과 따로 둔다 — 글자를 끌어 고르면 글자만, 본문 바깥 여백에서
 * 끌어 네모 영역(마키)으로 고르면 줄(블록)이 통째로 선택된다. 보이는 것과 지워지는 것이 같아야 한다.
 *
 * 상태는 선택된 줄들의 시작 위치(문서 순서)다. 줄은 최상위 블록이고, 목록은 항목 하나하나가 줄이다
 * (들여쓴 항목도 따로 고를 수 있다). 부모 항목을 고르면 자식 항목은 함께 딸려 간다.
 * 선택된 줄은 통째로 칠하고, 그 줄 중 하나의 핸들을 끌면 전부 함께 옮긴다(startBlockDrag).
 * 복사가 되도록 ProseMirror 선택도 첫 줄~마지막 줄의 글자 선택으로 맞춰 두되, 글자 선택 표시는 숨긴다.
 */
export const cmsBlockSelectionKey = new PluginKey<number[] | null>("cmsBlockSelection");

/** 블록 선택 중인 편집기와 선택된 줄에 붙는 클래스(스타일은 편집기 클래스에 둔다). */
export const BLOCK_RANGE_CLASS = "cms-block-range";
export const BLOCK_SELECTED_CLASS = "cms-block-selected";

const LIST_NODES = new Set(["bulletList", "orderedList", "taskList"]);

export const selectedBlocks = (state: EditorState): number[] | null => cmsBlockSelectionKey.getState(state) ?? null;

/** 줄 목록을 정리한다: 문서 순서, 중복 제거, 이미 고른 줄(부모 항목) 안의 줄은 뺀다. */
function normalize(doc: PmNode, positions: readonly number[]): number[] {
	const sorted = [...new Set(positions)].sort((a, b) => a - b);
	const result: number[] = [];
	let coveredUntil = -1;
	for (const pos of sorted) {
		const node = doc.nodeAt(pos);
		if (!node || pos < coveredUntil) continue;
		result.push(pos);
		coveredUntil = pos + node.nodeSize;
	}
	return result;
}

/** 줄들을 선택한다. 복사가 되도록 ProseMirror 선택도 첫 줄~마지막 줄의 글자로 맞춘다. */
export function setBlockSelection(tr: Transaction, positions: readonly number[] | null): Transaction {
	const rows = positions ? normalize(tr.doc, positions) : [];
	tr.setMeta(cmsBlockSelectionKey, rows.length ? rows : null);
	const first = rows[0];
	const lastPos = rows[rows.length - 1];
	const last = lastPos === undefined ? null : tr.doc.nodeAt(lastPos);
	if (first !== undefined && lastPos !== undefined && last)
		tr.setSelection(
			TextSelection.between(
				tr.doc.resolve(Math.min(first + 1, tr.doc.content.size)),
				tr.doc.resolve(Math.max(lastPos + last.nodeSize - 1, 0)),
			),
		);
	return tr;
}

const clearBlockSelection = (view: EditorView) => {
	if (selectedBlocks(view.state)) view.dispatch(view.state.tr.setMeta(cmsBlockSelectionKey, null));
};

/** 선택된 줄들을 통째로 지운다. 목록 항목이 모두 빠지면 목록째, 비면 안 되는 자리는 빈 문단을 남긴다. */
export function deleteSelectedBlocks(state: EditorState): Transaction | null {
	const rows = selectedBlocks(state);
	if (!rows) return null;
	const tr = deleteBlockSet(state.tr, rows);
	tr.setMeta(cmsBlockSelectionKey, null);
	const at = Math.min(tr.mapping.map(rows[0] ?? 0), tr.doc.content.size);
	tr.setSelection(TextSelection.near(tr.doc.resolve(at)));
	return tr.scrollIntoView();
}

const decorationsFor = (state: EditorState) => {
	const rows = selectedBlocks(state);
	if (!rows) return null;
	const decorations = rows.flatMap((pos) => {
		const node = state.doc.nodeAt(pos);
		return node ? [Decoration.node(pos, pos + node.nodeSize, { class: BLOCK_SELECTED_CLASS })] : [];
	});
	return DecorationSet.create(state.doc, decorations);
};

/** 블록 선택 중 누른 키. 줄째 지우기·잘라내기, 나머지 입력은 부분 덮어쓰기를 막고 선택만 푼다. */
function handleBlockSelectionKey(view: EditorView, event: KeyboardEvent): boolean {
	if (!selectedBlocks(view.state)) return false;
	const mod = event.metaKey || event.ctrlKey;
	if (event.key === "Backspace" || event.key === "Delete") {
		const tr = deleteSelectedBlocks(view.state);
		if (tr) view.dispatch(tr);
		return true;
	}
	if (mod && event.key.toLowerCase() === "x") {
		// 복사는 ProseMirror가 같은 범위의 글자 선택으로 처리한다. 지우기만 줄째 한다.
		document.execCommand("copy");
		const tr = deleteSelectedBlocks(view.state);
		if (tr) view.dispatch(tr);
		return true;
	}
	if (mod || event.key === "Shift" || event.key === "Alt" || event.key === "Meta" || event.key === "Control")
		return false; // 복사·실행 취소·전체 선택 등은 그대로 둔다
	if (event.key === "Escape") {
		clearBlockSelection(view);
		return true;
	}
	if (event.key.startsWith("Arrow")) {
		clearBlockSelection(view);
		return false;
	}
	// 글자·Enter 등: 여러 줄의 글자를 부분적으로 덮어쓰지 않게 막고 선택만 푼다.
	clearBlockSelection(view);
	return true;
}

const MARQUEE_THRESHOLD = 4;

/** 본문 칸(편집기 안쪽 여백을 뺀 영역)의 좌우 바깥인지. 마키 선택은 여기서만 시작한다. */
export function isOutsideContentColumn(view: EditorView, clientX: number): boolean {
	const rect = view.dom.getBoundingClientRect();
	const style = getComputedStyle(view.dom);
	const left = rect.left + (Number.parseFloat(style.paddingLeft) || 0);
	const right = rect.right - (Number.parseFloat(style.paddingRight) || 0);
	return clientX < left || clientX > right;
}

export function createBlockSelectionPlugin() {
	return new Plugin<number[] | null>({
		key: cmsBlockSelectionKey,
		state: {
			init: () => null,
			apply(tr, value) {
				const meta = tr.getMeta(cmsBlockSelectionKey) as number[] | null | undefined;
				if (meta !== undefined) return meta;
				const moved = tr.getMeta(MOVED_BLOCKS_META) as number[] | undefined;
				if (moved?.length) return normalize(tr.doc, moved);
				if (!value) return null;
				// 다른 선택이 일어나면 블록 선택을 푼다(블록 선택은 마키·핸들 이동으로만 이어진다).
				if (tr.selectionSet) return null;
				// 선택과 무관한 문서 변경(끝 빈 문단 추가 등)은 위치만 따라간다.
				if (!tr.docChanged) return value;
				const mapped = normalize(
					tr.doc,
					value.map((pos) => tr.mapping.map(pos, 1)),
				);
				return mapped.length ? mapped : null;
			},
		},
		props: {
			attributes: (state): Record<string, string> => (selectedBlocks(state) ? { class: BLOCK_RANGE_CLASS } : {}),
			decorations: decorationsFor,
			handleKeyDown: handleBlockSelectionKey,
			handleDOMEvents: {
				mousedown(view, event) {
					// 편집기 자체의 좌우 여백(본문 칸 바깥)을 누르면 마키 선택을 시작한다. 여기서 처리해야
					// ProseMirror가 같은 누름으로 글자 커서를 함께 옮기지 않는다.
					if (event.target === view.dom && isOutsideContentColumn(view, event.clientX)) {
						startMarquee(view, event);
						return true;
					}
					// 본문을 누르면(글자 선택을 시작하면) 블록 선택을 푼다.
					clearBlockSelection(view);
					return false;
				},
			},
		},
	});
}

type Row = { pos: number; top: number; bottom: number };

/**
 * 마키가 고를 수 있는 줄과 그 세로 위치(문서 순서). 최상위 블록이 줄이고, 목록은 항목마다 줄이다.
 * 항목 줄의 높이는 항목의 첫 블록(글자 줄)만 본다 — 들여쓴 자식을 포함하면 자식만 덮어도 부모가 골라진다.
 */
function rowsOf(view: EditorView): Row[] {
	const rows: Row[] = [];
	const rectOf = (pos: number) => {
		const dom = view.nodeDOM(pos);
		return dom instanceof HTMLElement ? dom.getBoundingClientRect() : null;
	};
	const addList = (list: PmNode, listPos: number) => {
		list.forEach((item, itemOffset) => {
			const itemPos = listPos + 1 + itemOffset;
			const line = rectOf(itemPos + 1) ?? rectOf(itemPos);
			if (line) rows.push({ pos: itemPos, top: line.top, bottom: line.bottom });
			item.forEach((child, childOffset) => {
				if (LIST_NODES.has(child.type.name)) addList(child, itemPos + 1 + childOffset);
			});
		});
	};
	view.state.doc.forEach((node, offset) => {
		if (LIST_NODES.has(node.type.name)) {
			addList(node, offset);
			return;
		}
		const rect = rectOf(offset);
		if (rect) rows.push({ pos: offset, top: rect.top, bottom: rect.bottom });
	});
	return rows;
}

/** 스크롤되는 가장 가까운 조상(없으면 문서). 마키가 화면 끝에 닿으면 이것을 굴린다. */
function scrollParentOf(element: HTMLElement): HTMLElement {
	let current = element.parentElement;
	while (current) {
		const { overflowY } = getComputedStyle(current);
		if ((overflowY === "auto" || overflowY === "scroll") && current.scrollHeight > current.clientHeight) return current;
		current = current.parentElement;
	}
	return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

const AUTO_SCROLL_EDGE = 48;
const AUTO_SCROLL_MAX_SPEED = 18;

/**
 * 마키(네모 영역) 선택을 시작한다. 본문 바깥 여백에서 누른 채 끌면 네모를 그리고, 네모의 세로 범위에
 * 걸친 줄들을 선택한다(사이 줄을 건너뛰지 않고 첫~마지막 줄까지 이어서). 화면 위아래 끝에 닿으면 스크롤한다.
 * 조금만 움직이고 놓으면(클릭) 아무것도 하지 않는다.
 */
export function startMarquee(view: EditorView, event: MouseEvent): void {
	if (event.button !== 0) return;
	event.preventDefault();
	const scroller = scrollParentOf(view.dom);
	const isDocumentScroller = scroller === document.scrollingElement || scroller === document.documentElement;
	// 시작점은 스크롤과 무관한 내용 좌표로 기억한다(자동 스크롤 중에도 네모가 시작점에 붙어 있게).
	const startScroll = scroller.scrollTop;
	const startX = event.clientX;
	const startY = event.clientY;
	let pointerX = startX;
	let pointerY = startY;
	let box: HTMLDivElement | null = null;
	let moved = false;
	let frame = 0;

	const render = () => {
		const scrolled = scroller.scrollTop - startScroll;
		const anchorY = startY - scrolled; // 시작점의 현재 화면 위치
		const left = Math.min(startX, pointerX);
		const top = Math.min(anchorY, pointerY);
		const bottom = Math.max(anchorY, pointerY);
		if (!box) {
			box = document.createElement("div");
			box.setAttribute("aria-hidden", "true");
			box.dataset.cmsMarquee = "";
			box.className = "pointer-events-none fixed z-50 rounded-sm border border-cms-primary/60 bg-cms-primary/10";
			document.body.appendChild(box);
		}
		box.style.left = `${left}px`;
		box.style.top = `${top}px`;
		box.style.width = `${Math.abs(pointerX - startX)}px`;
		box.style.height = `${bottom - top}px`;

		const rows = rowsOf(view);
		const first = rows.findIndex((row) => row.bottom >= top && row.top <= bottom);
		const last = rows.findLastIndex((row) => row.bottom >= top && row.top <= bottom);
		const next = first === -1 ? null : rows.slice(first, last + 1).map((row) => row.pos);
		const current = selectedBlocks(view.state);
		const normalized = next ? normalize(view.state.doc, next) : null;
		if (JSON.stringify(normalized) !== JSON.stringify(current))
			view.dispatch(setBlockSelection(view.state.tr, normalized).setMeta("addToHistory", false));
	};

	// 화면(스크롤 영역) 위아래 끝 가까이에 있으면 가까운 만큼 빠르게 굴린다.
	const autoScroll = () => {
		const area = isDocumentScroller ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect();
		const speed =
			pointerY < area.top + AUTO_SCROLL_EDGE
				? -Math.ceil(((area.top + AUTO_SCROLL_EDGE - pointerY) / AUTO_SCROLL_EDGE) * AUTO_SCROLL_MAX_SPEED)
				: pointerY > area.bottom - AUTO_SCROLL_EDGE
					? Math.ceil(((pointerY - (area.bottom - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE) * AUTO_SCROLL_MAX_SPEED)
					: 0;
		if (speed !== 0) {
			const before = scroller.scrollTop;
			scroller.scrollTop += speed;
			if (scroller.scrollTop !== before) render();
		}
		frame = requestAnimationFrame(autoScroll);
	};

	const move = (moveEvent: MouseEvent) => {
		pointerX = moveEvent.clientX;
		pointerY = moveEvent.clientY;
		if (!moved && Math.hypot(pointerX - startX, pointerY - startY) < MARQUEE_THRESHOLD) return;
		if (!moved) {
			moved = true;
			frame = requestAnimationFrame(autoScroll);
		}
		render();
	};

	const end = () => {
		window.removeEventListener("mousemove", move);
		window.removeEventListener("mouseup", end);
		cancelAnimationFrame(frame);
		box?.remove();
		if (!moved) return;
		// 끌기가 끝나며 생기는 click이 편집기 바깥 클릭(끝으로 이동)으로 처리되어 선택을 풀지 않게 한 번 삼킨다.
		const swallow = (clickEvent: MouseEvent) => {
			clickEvent.stopPropagation();
			clickEvent.preventDefault();
		};
		window.addEventListener("click", swallow, { capture: true, once: true });
		// click은 mouseup 바로 뒤에 온다. 오지 않았으면(영역 밖에서 놓음) 다음 클릭을 삼키지 않게 치운다.
		setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
		if (selectedBlocks(view.state)) view.focus();
	};

	window.addEventListener("mousemove", move);
	window.addEventListener("mouseup", end);
}
