import { createTranslator } from "@monti-cms/core/client";
import { type Editor, Extension } from "@tiptap/core";
import { Fragment, type Node as PmNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { type TargetBlock, targetBlockAt } from "./drag/block-resolve";
import { editorMessages } from "./messages";

const t = createTranslator(editorMessages);

/**
 * 블록 조작(§4.2): 위·아래 이동, 복제, 삭제. 블록 핸들 메뉴와 키보드 단축키가 같은 명령을 쓴다.
 * 문단과 커스텀 블록(원문 상자·이미지·표), 그리고 중첩 블록(목록 항목, 인용구 안)을 지원한다.
 */

interface TopLevelBlock {
	index: number;
	start: number;
	end: number;
	node: PmNode;
}

const isTargetBlock = (block: TargetBlock | TopLevelBlock): block is TargetBlock => "parent" in block;

/** 문서 위치가 속한 최상위 블록(기존 호환 유지). */
export function topLevelBlockAt(doc: PmNode, pos: number): TopLevelBlock | null {
	if (doc.childCount === 0) return null;
	const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
	const index = Math.min($pos.index(0), doc.childCount - 1);
	let start = 0;
	for (let i = 0; i < index; i++) start += doc.child(i).nodeSize;
	const node = doc.child(index);
	return { index, start, end: start + node.nodeSize, node };
}

const selectionInside = (doc: PmNode, from: number) =>
	TextSelection.near(doc.resolve(Math.min(from + 1, doc.content.size)));

export function moveBlock(editor: Editor, pos: number, direction: -1 | 1): boolean {
	const { state } = editor;
	const target = targetBlockAt(state.doc, pos) ?? topLevelBlockAt(state.doc, pos);
	if (!target) return false;

	const parent: PmNode = isTargetBlock(target) ? target.parent : state.doc;
	const neighborIndex = target.index + direction;
	if (neighborIndex < 0 || neighborIndex >= parent.childCount) return false;

	const neighbor = parent.child(neighborIndex);
	const from = direction < 0 ? target.start - neighbor.nodeSize : target.start;
	const to = direction < 0 ? target.end : target.end + neighbor.nodeSize;
	const ordered = direction < 0 ? [target.node, neighbor] : [neighbor, target.node];
	const tr = state.tr.replaceWith(from, to, Fragment.fromArray(ordered));
	const movedStart = direction < 0 ? from : from + neighbor.nodeSize;
	tr.setSelection(selectionInside(tr.doc, movedStart)).scrollIntoView();
	editor.view.dispatch(tr);
	return true;
}

export function duplicateBlock(editor: Editor, pos: number): boolean {
	const { state } = editor;
	const target = targetBlockAt(state.doc, pos) ?? topLevelBlockAt(state.doc, pos);
	if (!target) return false;
	const $target = state.doc.resolve(target.start);
	if (!$target.parent.canReplaceWith($target.index() + 1, $target.index() + 1, target.node.type)) return false;
	const tr = state.tr.insert(target.end, target.node.copy(target.node.content));
	tr.setSelection(selectionInside(tr.doc, target.end)).scrollIntoView();
	editor.view.dispatch(tr);
	return true;
}

export function deleteBlock(editor: Editor, pos: number): boolean {
	const { state } = editor;
	const target = targetBlockAt(state.doc, pos) ?? topLevelBlockAt(state.doc, pos);
	if (!target) return false;
	const $target = state.doc.resolve(target.start);
	if (!$target.parent.canReplace($target.index(), $target.index() + 1)) return false;
	const tr = state.tr.delete(target.start, target.end);
	if (tr.doc.childCount > 0) tr.setSelection(selectionInside(tr.doc, Math.min(target.start, tr.doc.content.size - 1)));
	editor.view.dispatch(tr);
	return true;
}

/** 마우스 없이 블록을 조작하는 단축키(§4.2 "마우스 없이도 실행"). */
export const CmsBlockKeymap = Extension.create({
	name: "cmsBlockKeymap",
	addKeyboardShortcuts() {
		// 키보드는 v1처럼 최상위 블록 단위로 조작한다(§4.2). 중첩 블록은 핸들 드래그·메뉴로 옮긴다.
		const at = () => {
			const { doc, selection } = this.editor.state;
			return topLevelBlockAt(doc, selection.from)?.start ?? selection.from;
		};
		return {
			"Alt-ArrowUp": () => moveBlock(this.editor, at(), -1),
			"Alt-ArrowDown": () => moveBlock(this.editor, at(), 1),
			"Mod-Shift-d": () => duplicateBlock(this.editor, at()),
			"Mod-Shift-Backspace": () => deleteBlock(this.editor, at()),
		};
	},
});

export const BLOCK_SHORTCUTS = [
	{ keys: "Alt+↑ / Alt+↓", label: t("blockShortcut.move") },
	{ keys: "Mod+Shift+D", label: t("blockShortcut.duplicate") },
	{ keys: "Mod+Shift+Backspace", label: t("blockShortcut.delete") },
] as const;
