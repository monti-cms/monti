import { createTranslator } from "@monti-cms/core/client";
import { Extension } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { targetBlockAt } from "./drag/block-resolve.js";
import { editorMessages } from "./messages.js";
const t = createTranslator(editorMessages);
const isTargetBlock = (block) => "parent" in block;
/** Top-level block containing the document position (kept for backward compatibility). */
export function topLevelBlockAt(doc, pos) {
    if (doc.childCount === 0)
        return null;
    const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
    const index = Math.min($pos.index(0), doc.childCount - 1);
    let start = 0;
    for (let i = 0; i < index; i++)
        start += doc.child(i).nodeSize;
    const node = doc.child(index);
    return { index, start, end: start + node.nodeSize, node };
}
const selectionInside = (doc, from) => TextSelection.near(doc.resolve(Math.min(from + 1, doc.content.size)));
export function moveBlock(editor, pos, direction) {
    const { state } = editor;
    const target = targetBlockAt(state.doc, pos) ?? topLevelBlockAt(state.doc, pos);
    if (!target)
        return false;
    const parent = isTargetBlock(target) ? target.parent : state.doc;
    const neighborIndex = target.index + direction;
    if (neighborIndex < 0 || neighborIndex >= parent.childCount)
        return false;
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
export function duplicateBlock(editor, pos) {
    const { state } = editor;
    const target = targetBlockAt(state.doc, pos) ?? topLevelBlockAt(state.doc, pos);
    if (!target)
        return false;
    const $target = state.doc.resolve(target.start);
    if (!$target.parent.canReplaceWith($target.index() + 1, $target.index() + 1, target.node.type))
        return false;
    const tr = state.tr.insert(target.end, target.node.copy(target.node.content));
    tr.setSelection(selectionInside(tr.doc, target.end)).scrollIntoView();
    editor.view.dispatch(tr);
    return true;
}
export function deleteBlock(editor, pos) {
    const { state } = editor;
    const target = targetBlockAt(state.doc, pos) ?? topLevelBlockAt(state.doc, pos);
    if (!target)
        return false;
    const $target = state.doc.resolve(target.start);
    if (!$target.parent.canReplace($target.index(), $target.index() + 1))
        return false;
    const tr = state.tr.delete(target.start, target.end);
    if (tr.doc.childCount > 0)
        tr.setSelection(selectionInside(tr.doc, Math.min(target.start, tr.doc.content.size - 1)));
    editor.view.dispatch(tr);
    return true;
}
/** Shortcuts to operate blocks without a mouse. */
export const CmsBlockKeymap = Extension.create({
    name: "cmsBlockKeymap",
    addKeyboardShortcuts() {
        // The keyboard operates on top-level blocks, as in v1. Nested blocks are moved by handle drag or the menu.
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
];
