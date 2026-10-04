import { Extension } from "@tiptap/core";
import { Fragment, Slice } from "@tiptap/pm/model";
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";
import { createBlockSelectionPlugin, selectedBlocks } from "./block-selection.js";
import { calculateBlockSetDropPosition, calculateDropPosition, moveBlockNode, moveBlockSet } from "./drag-commands.js";
export const BLOCK_DRAG_MIME_TYPE = "application/x-cms-block-drag";
export const cmsBlockDragPluginKey = new PluginKey("cmsBlockDrag");
/** During a block drag, shows only the position where it will actually drop. Clears the indicator where dropping is not possible. */
function setDropIndicator(view, dropPos) {
    if (cmsBlockDragPluginKey.getState(view.state)?.dropPos === dropPos)
        return;
    view.dispatch(view.state.tr.setMeta(cmsBlockDragPluginKey, { dropPos }).setMeta("addToHistory", false));
}
/**
 * Draws a horizontal line at the drop position. Placed outside the document flow (absolute relative to offsetParent) so
 * it does not change the spacing between blocks or the first-block rules (no layout shift while dragging).
 */
function createDropIndicatorView(editorView) {
    let element = null;
    const remove = () => {
        element?.remove();
        element = null;
    };
    const update = (view) => {
        const dropPos = cmsBlockDragPluginKey.getState(view.state)?.dropPos;
        if (dropPos === null || dropPos === undefined)
            return remove();
        const $pos = view.state.doc.resolve(dropPos);
        const beforeDom = $pos.nodeBefore ? view.nodeDOM(dropPos - $pos.nodeBefore.nodeSize) : null;
        const afterDom = $pos.nodeAfter ? view.nodeDOM(dropPos) : null;
        const before = beforeDom instanceof HTMLElement ? beforeDom.getBoundingClientRect() : null;
        const after = afterDom instanceof HTMLElement ? afterDom.getBoundingClientRect() : null;
        const box = after ?? before;
        if (!box)
            return remove();
        const y = before && after ? (before.bottom + after.top) / 2 : after ? after.top : box.bottom;
        const parent = view.dom.offsetParent ?? view.dom.parentElement;
        if (!parent)
            return remove();
        const parentRect = parent.getBoundingClientRect();
        if (!element) {
            element = document.createElement("div");
            element.setAttribute("aria-hidden", "true");
            element.dataset.cmsDropIndicator = "";
            element.className = "pointer-events-none absolute z-50 h-0.5 -translate-y-1/2 rounded-full bg-cms-primary";
            parent.appendChild(element);
        }
        element.style.left = `${box.left - parentRect.left + parent.scrollLeft}px`;
        element.style.top = `${y - parentRect.top + parent.scrollTop}px`;
        element.style.width = `${box.width}px`;
    };
    update(editorView);
    return { update, destroy: remove };
}
/**
 * Called on block handle dragstart to initialize the ProseMirror drag state and dataTransfer.
 * If the grabbed block is inside a block selection (lines picked with the marquee), all selected lines are dragged together.
 */
export function startBlockDrag(view, pos, event) {
    const { state } = view;
    const node = state.doc.nodeAt(pos);
    if (!node)
        return false;
    // If the grabbed block is inside a block selection (lines picked with the marquee), drag all selected lines.
    const rows = selectedBlocks(state);
    const inSelection = rows?.some((row) => {
        const selected = state.doc.nodeAt(row);
        return !!selected && pos >= row && pos < row + selected.nodeSize;
    })
        ? rows
        : null;
    if (inSelection) {
        const first = inSelection[0] ?? pos;
        const lastPos = inSelection[inSelection.length - 1] ?? pos;
        const end = lastPos + (state.doc.nodeAt(lastPos)?.nodeSize ?? 0);
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", state.doc.textBetween(first, end, "\n"));
        }
        view.dragging = {
            slice: state.doc.slice(first, end),
            move: true,
            cmsBlockPos: first,
            cmsBlockSet: inSelection,
        };
        return true;
    }
    let selection = state.selection;
    // If a NodeSelection is possible, set it as the selection
    if (NodeSelection.isSelectable(node)) {
        selection = NodeSelection.create(state.doc, pos);
        view.dispatch(state.tr.setSelection(selection));
    }
    const slice = selection instanceof NodeSelection ? selection.content() : new Slice(Fragment.from(node), 0, 0);
    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", node.textContent);
        try {
            event.dataTransfer.setData(BLOCK_DRAG_MIME_TYPE, JSON.stringify({ pos, type: node.type.name }));
        }
        catch {
            // Ignore when some browsers restrict this
        }
    }
    // Set the ProseMirror default drag object (referenced by Dropcursor and the drop handler)
    view.dragging = {
        slice,
        move: true,
        node: selection instanceof NodeSelection ? selection : undefined,
        cmsBlockPos: pos,
    };
    return true;
}
/**
 * Cleans up state when the drag ends.
 */
export function endBlockDrag(view) {
    const viewAny = view;
    const dragging = viewAny.dragging;
    // Only clean up handle drags (the editor's own drags are cleaned up by ProseMirror).
    // Some browsers send dragend before drop, so wait briefly like ProseMirror and then clear.
    // After a move transaction ProseMirror may replace dragging with a new object and `cmsBlockPos` can vanish, so clear the indicator first.
    if (!view.isDestroyed)
        setDropIndicator(view, null);
    if (!dragging || dragging.cmsBlockPos === undefined)
        return;
    setTimeout(() => {
        if (viewAny.dragging === dragging)
            viewAny.dragging = null;
    }, 50);
}
/**
 * Tiptap block drag-and-drop extension.
 * Provides schema validation, a single undo transaction, and rejection of disallowed positions.
 */
export const CmsBlockDrag = Extension.create({
    name: "cmsBlockDrag",
    addProseMirrorPlugins() {
        return [
            // Block selection (blocks picked with the marquee). Dragging the handle of any one of them moves them all together (startBlockDrag).
            createBlockSelectionPlugin(),
            new Plugin({
                key: cmsBlockDragPluginKey,
                state: {
                    init: () => ({ dropPos: null }),
                    apply(tr, value) {
                        const meta = tr.getMeta(cmsBlockDragPluginKey);
                        if (meta)
                            return meta;
                        if (value.dropPos === null || !tr.docChanged)
                            return value;
                        return { dropPos: tr.mapping.map(value.dropPos) };
                    },
                },
                view: createDropIndicatorView,
                props: {
                    handleDOMEvents: {
                        dragover(view, event) {
                            const dragging = view.dragging;
                            if (dragging && dragging.cmsBlockPos !== undefined && event.dataTransfer) {
                                // The default Dropcursor does not know about schema rejection and points elsewhere. Block drags suppress it and show our own indicator.
                                event.stopImmediatePropagation();
                                const coords = { left: event.clientX, top: event.clientY };
                                const target = view.posAtCoords(coords);
                                const validPos = !target
                                    ? null
                                    : dragging.cmsBlockSet
                                        ? calculateBlockSetDropPosition(view.state.doc, dragging.cmsBlockSet, target.pos)
                                        : calculateDropPosition(view.state.doc, dragging.cmsBlockPos, target.pos, dragging.slice, dragging.cmsBlockEnd);
                                setDropIndicator(view, validPos);
                                event.dataTransfer.dropEffect = validPos === null ? "none" : "move";
                            }
                            return false;
                        },
                        dragleave(view, event) {
                            const related = event.relatedTarget;
                            if (related instanceof Node) {
                                if (!view.dom.contains(related))
                                    setDropIndicator(view, null);
                            }
                            else {
                                // Safari can give relatedTarget=null even at child boundaries. Clear only when actually outside the editor.
                                const rect = view.dom.getBoundingClientRect();
                                if (event.clientX < rect.left ||
                                    event.clientX > rect.right ||
                                    event.clientY < rect.top ||
                                    event.clientY > rect.bottom)
                                    setDropIndicator(view, null);
                            }
                            return false;
                        },
                        dragend(view) {
                            endBlockDrag(view);
                            return false;
                        },
                    },
                    handleDrop(view, event, slice) {
                        const dragging = view.dragging;
                        const cmsBlockPos = dragging?.cmsBlockPos;
                        const cmsBlockEnd = dragging?.cmsBlockEnd;
                        // Leave ordinary file/text drops that are not block handle drags to the default behavior
                        if (cmsBlockPos === undefined) {
                            return false;
                        }
                        event.preventDefault();
                        try {
                            const coords = { left: event.clientX, top: event.clientY };
                            const target = view.posAtCoords(coords);
                            if (!target) {
                                return true;
                            }
                            const blockSet = dragging?.cmsBlockSet;
                            const validDropPos = blockSet
                                ? calculateBlockSetDropPosition(view.state.doc, blockSet, target.pos)
                                : calculateDropPosition(view.state.doc, cmsBlockPos, target.pos, slice || dragging?.slice, cmsBlockEnd);
                            // Ignore the drop if the schema does not allow the position (source/document unchanged)
                            if (validDropPos === null) {
                                return true;
                            }
                            // Perform the move in a single transaction to guarantee exactly one undo
                            const tr = blockSet
                                ? moveBlockSet(view.state, blockSet, validDropPos)
                                : moveBlockNode(view.state, cmsBlockPos, validDropPos, cmsBlockEnd);
                            if (tr) {
                                view.dispatch(tr);
                                view.focus();
                            }
                            return true;
                        }
                        finally {
                            endBlockDrag(view);
                        }
                    },
                },
            }),
        ];
    },
});
