import { Fragment, type Node as PmNode, Slice } from "@tiptap/pm/model";
import { type EditorState, NodeSelection, Selection, TextSelection, type Transaction } from "@tiptap/pm/state";
import { canJoin, dropPoint } from "@tiptap/pm/transform";
import { BODY_CONTAINER_NODE_NAMES } from "../blocks/added/shared";

/**
 * 블록 드래그 앤 드롭 순수 명령 함수들(v2 C1).
 * DOM 의존 없이 ProseMirror 트랜잭션 및 스키마 검증을 jsdom/단위 테스트에서 수행할 수 있다.
 */

/** 여러 블록을 옮긴 뒤 옮긴 블록들의 위치(number[])를 알리는 트랜잭션 메타(블록 선택이 이어진다). */
export const MOVED_BLOCKS_META = "cmsMovedBlocks";

/** 비면 안 되는 목록. 유일한 항목을 옮기면 빈 목록째 뺀다. */
const LIST_NODES = new Set(["bulletList", "orderedList", "taskList"]);
/** 본문 블록이 하나 이상이어야 하는 CMS 컨테이너(블록 정의에서 만든다). 유일한 블록을 옮기면 빈 문단을 남긴다. */
const CONTAINER_BODY_NODES = BODY_CONTAINER_NODE_NAMES;

/** 블록을 꺼낼 때 지울 범위. `fill`이 있으면 그 자리를 fill로 채운다. 꺼낼 수 없으면 null. */
export interface SourceRange {
	from: number;
	to: number;
	fill?: PmNode;
}

/**
 * 옮길 블록 묶음: 같은 부모 안의 이웃한 블록들(from 앞 ~ to 뒤). 블록 하나면 `to`를 생략한다.
 * 같은 부모의 블록 경계가 아니면 null이다.
 */
const blockRangeAt = (doc: PmNode, fromPos: number, toPos?: number) => {
	if (fromPos < 0 || fromPos >= doc.content.size) return null;
	const node = doc.nodeAt(fromPos);
	if (!node) return null;
	const to = toPos ?? fromPos + node.nodeSize;
	if (to <= fromPos || to > doc.content.size) return null;
	const $from = doc.resolve(fromPos);
	const $to = doc.resolve(to);
	if ($from.depth !== $to.depth || !$from.sameParent($to)) return null;
	return { from: fromPos, to, $from, start: $from.index(), end: $to.index(), content: doc.slice(fromPos, to).content };
};

/**
 * 블록(들)을 꺼낸 자리가 스키마를 지키도록 지울 범위를 정한다.
 * - 부모가 그 블록 없이도 유효하면 블록만 지운다.
 * - 목록의 모든 항목(유일한 항목·들여쓴 항목 하나 등)이면 빈 목록을 남기지 않게 목록째 지운다.
 * - 컨테이너(콜아웃·접기·탭·단)의 모든 블록이면 빈 문단을 남긴다.
 * - 그 밖(목록 항목의 하나뿐인 문단 등)은 꺼내지 않는다. 빈 블록이 저절로 채워지는 것을 막는다.
 */
export function sourceRangeOf(doc: PmNode, fromPos: number, toPos?: number): SourceRange | null {
	const range = blockRangeAt(doc, fromPos, toPos);
	if (!range) return null;
	const { $from, start, end } = range;
	const parent = $from.parent;
	if (parent.canReplace(start, end)) return { from: range.from, to: range.to };

	const takesAll = start === 0 && end === parent.childCount;
	if (LIST_NODES.has(parent.type.name) && takesAll && $from.depth > 0) {
		const depth = $from.depth;
		const grand = $from.node(depth - 1);
		const index = $from.index(depth - 1);
		if (grand.canReplace(index, index + 1)) return { from: $from.before(depth), to: $from.after(depth) };
	}

	const paragraph = doc.type.schema.nodes.paragraph;
	if (CONTAINER_BODY_NODES.has(parent.type.name) && paragraph) {
		const fill = paragraph.create();
		if (parent.canReplaceWith(start, end, fill.type)) return { from: range.from, to: range.to, fill };
	}
	return null;
}

/**
 * 대상 위치(targetPos)가 스키마상 해당 블록(fromPos, 묶음이면 ~toPos)을 허용하는지 검증한다.
 * - 꺼낼 범위(sourceRangeOf) 안쪽이나 경계(no-op)로의 드롭은 거부한다.
 * - canReplace / contentMatch 검사를 통해 스키마가 허용하지 않는 위치는 거부한다.
 */
export function canDropBlockNode(doc: PmNode, fromPos: number, targetPos: number, toPos?: number): boolean {
	return placeableContentAt(doc, fromPos, targetPos, toPos) !== null;
}

/** 목록 항목. 목록 밖에 놓으면 원래 목록 종류로 감싼다. */
const LIST_ITEM_NODES = new Set(["listItem", "taskItem"]);

/** 항목(들)을 원래 목록 종류(글머리표·번호·체크)로 감싼 목록. 항목이 아니거나 감쌀 수 없으면 null. */
const wrapInSourceList = (doc: PmNode, fromPos: number, items: Fragment): PmNode | null => {
	let allItems = items.childCount > 0;
	items.forEach((item) => {
		if (!LIST_ITEM_NODES.has(item.type.name)) allItems = false;
	});
	if (!allItems) return null;
	const list = doc.resolve(fromPos).parent;
	if (!LIST_NODES.has(list.type.name)) return null;
	const { order: _order, ...attrs } = list.attrs as Record<string, unknown>;
	return list.type.validContent(items) ? list.type.create(attrs, items) : null;
};

/**
 * fromPos의 블록(묶음이면 ~toPos)을 targetPos에 놓을 때 실제로 넣을 내용. 놓을 수 없으면 null이다.
 * - 꺼낼 범위(sourceRangeOf) 안쪽이나 경계(no-op)로의 드롭은 거부한다.
 * - 목록 항목을 목록 밖(문단 사이·컨테이너 안)에 놓으면 원래 목록 종류로 감싸 넣는다(노션처럼 항목을
 *   목록 밖으로 끌어낼 수 있다). 자식 항목이 있는 항목은 자식째 옮긴다.
 */
export function placeableContentAt(
	doc: PmNode,
	fromPos: number,
	targetPos: number,
	toPos?: number,
): { content: Fragment; wrapped: PmNode | null } | null {
	const range = blockRangeAt(doc, fromPos, toPos);
	const source = sourceRangeOf(doc, fromPos, toPos);
	if (!range || !source) return null;

	if (targetPos >= source.from && targetPos <= source.to) return null;
	if (targetPos < 0 || targetPos > doc.content.size) return null;

	const $target = doc.resolve(targetPos);
	const index = $target.index();
	if ($target.parent.canReplace(index, index, range.content)) return { content: range.content, wrapped: null };

	const wrapped = wrapInSourceList(doc, fromPos, range.content);
	return wrapped && $target.parent.canReplaceWith(index, index, wrapped.type)
		? { content: Fragment.from(wrapped), wrapped }
		: null;
}

/**
 * 마우스 좌표/위치로부터 유효한 스키마 드롭 위치를 계산한다.
 * - 텍스트 블록 안으로 떨어진 경우 dropPoint를 통해 앞/뒤 부모 경계의 유효 위치를 탐색한다.
 * - 스키마가 허용하지 않는 경우 null을 반환하여 드롭을 무시한다.
 */
export function calculateDropPosition(
	doc: PmNode,
	fromPos: number,
	rawTargetPos: number,
	slice?: Slice,
	toPos?: number,
): number | null {
	const range = blockRangeAt(doc, fromPos, toPos);
	if (!range) return null;

	const contentSlice = slice ?? new Slice(range.content, 0, 0);

	// ProseMirror의 dropPoint를 통해 스키마에 맞는 유효 삽입 지점 계산 시도.
	// 목록 항목은 목록 밖에서 놓을 자리가 없으므로, 목록으로 감싼 모양으로 한 번 더 찾는다.
	let point = dropPoint(doc, rawTargetPos, contentSlice);
	const wrapped = point === null ? wrapInSourceList(doc, fromPos, range.content) : null;
	if (wrapped) point = dropPoint(doc, rawTargetPos, new Slice(Fragment.from(wrapped), 0, 0));

	if (point === null) {
		// 블록 사이 정확한 위치로 떨어진 경우 직접 canDropBlockNode 확인
		if (canDropBlockNode(doc, fromPos, rawTargetPos, toPos)) {
			point = rawTargetPos;
		} else {
			return null;
		}
	}

	// 최종 계산된 위치가 canDropBlockNode 조건을 만족하는지 재검증
	if (!canDropBlockNode(doc, fromPos, point, toPos)) {
		return null;
	}

	return point;
}

/** 이동된 노드에 적합한 선택 영역을 반환한다 (원자 노드는 NodeSelection, 일반 블록은 TextSelection/Selection). */
export function selectionForMovedNode(doc: PmNode, pos: number, node: PmNode): Selection | null {
	try {
		if (NodeSelection.isSelectable(node)) {
			return NodeSelection.create(doc, pos);
		}
	} catch {
		// 노드 선택이 불가능하면 텍스트 커서 선택으로 이동
	}
	try {
		return TextSelection.near(doc.resolve(Math.min(pos + 1, doc.content.size)));
	} catch {
		return Selection.near(doc.resolve(pos));
	}
}

/**
 * 단일 트랜잭션으로 블록(묶음이면 fromPos~toPos의 이웃 블록들)을 targetPos로 이동한다 ("한 드래그 = 한 undo").
 * 스키마가 허용하지 않으면 null을 반환하고 아무 작업도 하지 않는다.
 * 블록 하나를 옮기면 그 블록을 선택하고, 여러 개를 옮기면 옮긴 자리를 MOVED_BLOCKS_META로 알린다(블록 선택이 이어진다).
 */
export function moveBlockNode(
	state: EditorState,
	fromPos: number,
	targetPos: number,
	toPos?: number,
): Transaction | null {
	const { doc } = state;
	const range = blockRangeAt(doc, fromPos, toPos);
	const source = sourceRangeOf(doc, fromPos, toPos);
	const placed = placeableContentAt(doc, fromPos, targetPos, toPos);
	if (!range || !source || !placed) {
		return null;
	}

	const tr = state.tr;

	// 단일 트랜잭션 내에서 삭제 및 삽입을 함께 처리해 단 1회의 Undo 단계를 보장한다
	if (source.fill) tr.replaceWith(source.from, source.to, source.fill);
	else tr.delete(source.from, source.to);
	const insertedAt = tr.mapping.map(targetPos);
	tr.insert(insertedAt, placed.content);
	// 옮긴 블록들의 자리. 목록으로 감쌌으면 그 목록 안(항목들)이다.
	let movedStart = placed.wrapped ? insertedAt + 1 : insertedAt;
	let movedEnd = movedStart + range.content.size;

	// 목록으로 감싸 넣었는데 바로 옆이 같은 종류 목록이면 합친다. 뒤를 먼저 합친다(앞을 합치면 위치가 2 당겨진다).
	// 종류가 다른 목록(글머리표 ↔ 번호)은 합치지 않는다. canJoin은 항목이 같으면 종류가 달라도 허용한다.
	const { wrapped } = placed;
	if (wrapped) {
		const sameList = (pos: number, side: "before" | "after") => {
			const $pos = tr.doc.resolve(pos);
			const neighbor = side === "before" ? $pos.nodeBefore : $pos.nodeAfter;
			return neighbor?.type === wrapped.type && canJoin(tr.doc, pos);
		};
		const after = insertedAt + wrapped.nodeSize;
		if (sameList(after, "after")) tr.join(after);
		if (sameList(insertedAt, "before")) {
			tr.join(insertedAt);
			movedStart -= 2;
			movedEnd -= 2;
		}
	}

	const first = range.content.firstChild;
	const selection =
		range.content.childCount === 1 && first
			? selectionForMovedNode(tr.doc, movedStart, first)
			: TextSelection.between(tr.doc.resolve(movedStart + 1), tr.doc.resolve(movedEnd - 1));
	if (selection) {
		tr.setSelection(selection);
	}
	if (range.content.childCount > 1) {
		const moved: number[] = [];
		let offset = movedStart;
		range.content.forEach((child) => {
			moved.push(offset);
			offset += child.nodeSize;
		});
		tr.setMeta(MOVED_BLOCKS_META, moved);
	}
	tr.scrollIntoView();

	return tr;
}

/**
 * 블록 묶음(서로 다른 부모의 줄이 섞일 수 있다: 제목 + 목록 항목 일부 등)을 한 곳에 넣을 모양으로 만든다.
 * - 같은 목록에서 이어진 항목들은 그 목록 종류로 감싼다(목록 밖에 놓을 때).
 * - 모두 목록 항목이면 목록 사이에 놓을 때를 위해 항목 그대로의 모양도 함께 돌려준다.
 */
function blockSetContent(doc: PmNode, positions: readonly number[]) {
	const groups: Array<{ list: PmNode | null; nodes: PmNode[] }> = [];
	const items: PmNode[] = [];
	let itemsOnly = positions.length > 0;
	for (const pos of positions) {
		const node = doc.nodeAt(pos);
		if (!node) return null;
		const parent = doc.resolve(pos).parent;
		const isItem = LIST_ITEM_NODES.has(node.type.name) && LIST_NODES.has(parent.type.name);
		if (isItem) items.push(node);
		else itemsOnly = false;
		const last = groups[groups.length - 1];
		if (isItem && last?.list === parent) last.nodes.push(node);
		else groups.push({ list: isItem ? parent : null, nodes: [node] });
	}
	const blocks = groups.map(({ list, nodes }) => {
		if (!list) return nodes[0] as PmNode;
		const { order: _order, ...attrs } = list.attrs as Record<string, unknown>;
		return list.type.create(attrs, nodes);
	});
	return { blocks: Fragment.fromArray(blocks), items: itemsOnly ? Fragment.fromArray(items) : null };
}

/** 묶음을 targetPos에 놓을 때 넣을 내용. 묶음 안쪽이거나 스키마가 허용하지 않으면 null이다. */
export function placeableBlockSetAt(doc: PmNode, positions: readonly number[], targetPos: number): Fragment | null {
	if (targetPos < 0 || targetPos > doc.content.size) return null;
	for (const pos of positions) {
		const node = doc.nodeAt(pos);
		if (!node || (targetPos >= pos && targetPos <= pos + node.nodeSize)) return null;
	}
	const content = blockSetContent(doc, positions);
	if (!content) return null;
	const $target = doc.resolve(targetPos);
	const index = $target.index();
	if (content.items && $target.parent.canReplace(index, index, content.items)) return content.items;
	return $target.parent.canReplace(index, index, content.blocks) ? content.blocks : null;
}

/** 묶음을 놓을 유효한 위치(끌기 중 표시와 놓기에 쓴다). */
export function calculateBlockSetDropPosition(
	doc: PmNode,
	positions: readonly number[],
	rawTargetPos: number,
): number | null {
	const content = blockSetContent(doc, positions);
	if (!content) return null;
	const candidates = [content.items, content.blocks].filter((fragment): fragment is Fragment => !!fragment);
	for (const fragment of candidates) {
		const point = dropPoint(doc, rawTargetPos, new Slice(fragment, 0, 0)) ?? rawTargetPos;
		if (placeableBlockSetAt(doc, positions, point)) return point;
	}
	return null;
}

/**
 * 묶음에서 줄들을 지운다(뒤에서부터). 목록의 항목이 모두 빠지면 목록째, 컨테이너가 비면 빈 문단을 남긴다.
 * 문서가 통째로 비면 빈 문단 하나를 남긴다.
 */
export function deleteBlockSet(tr: Transaction, positions: readonly number[]): Transaction {
	for (const original of [...positions].reverse()) {
		const pos = tr.mapping.map(original);
		const node = tr.doc.nodeAt(pos);
		if (!node) continue;
		const source = sourceRangeOf(tr.doc, pos);
		if (source?.fill) tr.replaceWith(source.from, source.to, source.fill);
		else if (source) tr.delete(source.from, source.to);
		else {
			const paragraph = tr.doc.type.schema.nodes.paragraph;
			if (paragraph) tr.replaceWith(pos, pos + node.nodeSize, paragraph.create());
		}
	}
	return tr;
}

/**
 * 블록 묶음을 targetPos로 옮긴다(한 번의 되돌리기). 옮긴 줄들의 새 위치를 MOVED_BLOCKS_META로 알린다.
 * 넣은 자리 양옆과 넣은 내용 사이의 같은 종류 목록은 합친다.
 */
export function moveBlockSet(state: EditorState, positions: readonly number[], targetPos: number): Transaction | null {
	const content = placeableBlockSetAt(state.doc, positions, targetPos);
	if (!content) return null;
	const tr = deleteBlockSet(state.tr, positions);
	const insertedAt = tr.mapping.map(targetPos);
	tr.insert(insertedAt, content);
	const afterInsert = tr.steps.length;

	// 옮긴 줄의 위치: 항목이면 감싼 목록 안, 아니면 블록 자신.
	const moved: number[] = [];
	let offset = insertedAt;
	content.forEach((node) => {
		// 줄로 고를 수 있는 목록은 없다(항목이 줄이다). 넣은 목록은 항목을 감싼 것이고, 그 항목들이 옮긴 줄이다.
		if (LIST_NODES.has(node.type.name)) {
			let inner = offset + 1;
			node.forEach((item) => {
				moved.push(inner);
				inner += item.nodeSize;
			});
		} else moved.push(offset);
		offset += node.nodeSize;
	});

	// 같은 종류 목록끼리 맞닿은 경계를 뒤에서부터 합친다.
	const boundaries: number[] = [insertedAt];
	let boundary = insertedAt;
	content.forEach((node) => {
		boundary += node.nodeSize;
		boundaries.push(boundary);
	});
	for (const at of boundaries.reverse()) {
		const $at = tr.doc.resolve(tr.mapping.slice(afterInsert).map(at));
		const before = $at.nodeBefore;
		const after = $at.nodeAfter;
		if (before && after && before.type === after.type && LIST_NODES.has(before.type.name) && canJoin(tr.doc, $at.pos))
			tr.join($at.pos);
	}

	const mapping = tr.mapping.slice(afterInsert);
	const finalPositions = moved.map((pos) => mapping.map(pos, 1));
	const first = finalPositions[0];
	const lastPos = finalPositions[finalPositions.length - 1];
	const last = lastPos === undefined ? undefined : tr.doc.nodeAt(lastPos);
	if (first !== undefined && lastPos !== undefined && last)
		tr.setSelection(TextSelection.between(tr.doc.resolve(first + 1), tr.doc.resolve(lastPos + last.nodeSize - 1)));
	tr.setMeta(MOVED_BLOCKS_META, finalPositions);
	return tr.scrollIntoView();
}
