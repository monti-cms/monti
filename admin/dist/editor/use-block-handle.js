/**
 * The block handle that floats beside the hovered block: tracks which block it points to, where it sits, and keeps it
 * attached while the page scrolls or resizes.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { endBlockDrag, findBlockDOM, refineBlock, resolveTargetBlock, startBlockDrag } from "./drag/index.js";
/** Handle width (px) and gap from the block. BlockHandleOverlay places a 24px button at `left - 32`. */
const HANDLE_OFFSET = 32;
const HANDLE_WIDTH = 24;
/**
 * Anchor point for attaching the handle.
 * - List items attach to the left of the list (outside the bullet) so the bullet is not covered. Indented items attach to their indentation.
 * - When the handle of a block inside a bordered container (callout, fold, tabs, columns) would sit on its left border,
 *   move it to the container's outside handle position (align on the same vertical line).
 */
const handleAnchor = (block, rect) => {
    const isListItem = block.tagName === "LI" || block.getAttribute("data-type") === "taskItem";
    const list = isListItem ? block.parentElement : null;
    let left = list ? list.getBoundingClientRect().left : rect.left;
    const framed = block.parentElement?.closest("[data-cms-framed]");
    if (framed) {
        const edge = framed.getBoundingClientRect().left;
        const handleLeft = left - HANDLE_OFFSET;
        if (handleLeft <= edge + 1 && handleLeft + HANDLE_WIDTH >= edge - 1)
            left = edge;
    }
    return { top: rect.top, left };
};
const sameSpot = (a, b) => !!a && a.top === b.top && a.left === b.left && a.pos === b.pos;
export function useBlockHandle(editor) {
    const [handleSpot, setHandleSpot] = useState(null);
    const activeBlockRectRef = useRef(null);
    const activeBlockPosRef = useRef(null);
    const activeBlockElRef = useRef(null);
    const handleMouseMove = useCallback((event) => {
        if (!editor)
            return;
        const root = editor.view.dom;
        // Do not change the target on the way from a block to the left handle (left margin of the block, list indentation).
        // Otherwise the target switches to the whole list while moving from a list item to the handle.
        const active = activeBlockRectRef.current;
        if (active && event.clientX < active.left && event.clientY >= active.top && event.clientY <= active.bottom)
            return;
        const found = findBlockDOM(root, event.target);
        if (!found)
            return;
        const block = refineBlock(found, event.clientX, event.clientY);
        try {
            const resolved = resolveTargetBlock(editor.view, block);
            if (!resolved)
                return;
            activeBlockPosRef.current = resolved.pos;
            activeBlockRectRef.current = resolved.rect;
            activeBlockElRef.current = block;
            const spot = { ...handleAnchor(block, resolved.rect), pos: resolved.pos };
            // Do not change state at the same position. If the editor re-renders on every mouse move (useEditor
            // resets options), node views update and things like table column resize dragging get shaky.
            setHandleSpot((previous) => (sameSpot(previous, spot) ? previous : spot));
        }
        catch {
            // Ignore if the DOM is just being replaced.
        }
    }, [editor]);
    // The handle floats at a fixed screen position. On scroll it follows the block, and hides if the block is gone.
    // Otherwise a stale handle remains next to a wrong block after scrolling, so it looks like the same item has two handles.
    const hasHandle = handleSpot !== null;
    useEffect(() => {
        if (!hasHandle || !editor)
            return;
        const follow = () => {
            const element = activeBlockElRef.current;
            const pos = activeBlockPosRef.current;
            if (!element?.isConnected || pos === null) {
                setHandleSpot(null);
                return;
            }
            const rect = element.getBoundingClientRect();
            activeBlockRectRef.current = rect;
            const spot = { ...handleAnchor(element, rect), pos };
            setHandleSpot((previous) => (sameSpot(previous, spot) ? previous : spot));
        };
        window.addEventListener("scroll", follow, true);
        window.addEventListener("resize", follow);
        return () => {
            window.removeEventListener("scroll", follow, true);
            window.removeEventListener("resize", follow);
        };
    }, [hasHandle, editor]);
    const handleDragStart = useCallback((pos, event) => {
        if (!editor)
            return;
        startBlockDrag(editor.view, pos, event);
    }, [editor]);
    const handleDragEnd = useCallback(() => {
        if (!editor)
            return;
        endBlockDrag(editor.view);
    }, [editor]);
    return { handleSpot, setHandleSpot, handleMouseMove, handleDragStart, handleDragEnd };
}
