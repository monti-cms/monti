import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { deleteBlockSet, MOVED_BLOCKS_META } from "./drag-commands.js";
/**
 * Block selection (like Notion block selection). Kept separate from text selection: dragging over text selects only text, while
 * dragging a box (marquee) from the margin outside the body selects whole lines (blocks). What is visible and what gets deleted must match.
 *
 * State is the start positions of the selected lines (document order). A line is a top-level block, and in lists every item is its own line
 * (indented items can also be picked separately). Selecting a parent item brings its child items along.
 * Selected lines are painted whole, and dragging the handle of any one of them moves them all together (startBlockDrag).
 * So that copy works, the ProseMirror selection is also set to a text selection from the first to the last line, but the text selection highlight is hidden.
 */
export const cmsBlockSelectionKey = new PluginKey("cmsBlockSelection");
/** Classes put on the editor while a block selection is active and on the selected lines (styles live in the editor class). */
export const BLOCK_RANGE_CLASS = "cms-block-range";
export const BLOCK_SELECTED_CLASS = "cms-block-selected";
const LIST_NODES = new Set(["bulletList", "orderedList", "taskList"]);
export const selectedBlocks = (state) => cmsBlockSelectionKey.getState(state) ?? null;
/** Normalizes a list of lines: document order, deduplicated, and lines inside an already selected line (parent item) are dropped. */
function normalize(doc, positions) {
    const sorted = [...new Set(positions)].sort((a, b) => a - b);
    const result = [];
    let coveredUntil = -1;
    for (const pos of sorted) {
        const node = doc.nodeAt(pos);
        if (!node || pos < coveredUntil)
            continue;
        result.push(pos);
        coveredUntil = pos + node.nodeSize;
    }
    return result;
}
/** Selects lines. So that copy works, the ProseMirror selection is also set to the text from the first to the last line. */
export function setBlockSelection(tr, positions) {
    const rows = positions ? normalize(tr.doc, positions) : [];
    tr.setMeta(cmsBlockSelectionKey, rows.length ? rows : null);
    const first = rows[0];
    const lastPos = rows[rows.length - 1];
    const last = lastPos === undefined ? null : tr.doc.nodeAt(lastPos);
    if (first !== undefined && lastPos !== undefined && last)
        tr.setSelection(TextSelection.between(tr.doc.resolve(Math.min(first + 1, tr.doc.content.size)), tr.doc.resolve(Math.max(lastPos + last.nodeSize - 1, 0))));
    return tr;
}
const clearBlockSelection = (view) => {
    if (selectedBlocks(view.state))
        view.dispatch(view.state.tr.setMeta(cmsBlockSelectionKey, null));
};
/** Deletes the selected lines whole. If all list items go, the list goes too; where the slot cannot be empty, an empty paragraph is left. */
export function deleteSelectedBlocks(state) {
    const rows = selectedBlocks(state);
    if (!rows)
        return null;
    const tr = deleteBlockSet(state.tr, rows);
    tr.setMeta(cmsBlockSelectionKey, null);
    const at = Math.min(tr.mapping.map(rows[0] ?? 0), tr.doc.content.size);
    tr.setSelection(TextSelection.near(tr.doc.resolve(at)));
    return tr.scrollIntoView();
}
const decorationsFor = (state) => {
    const rows = selectedBlocks(state);
    if (!rows)
        return null;
    const decorations = rows.flatMap((pos) => {
        const node = state.doc.nodeAt(pos);
        return node ? [Decoration.node(pos, pos + node.nodeSize, { class: BLOCK_SELECTED_CLASS })] : [];
    });
    return DecorationSet.create(state.doc, decorations);
};
/** Key pressed during a block selection. Delete and cut remove whole lines; any other input is blocked from partially overwriting and just clears the selection. */
function handleBlockSelectionKey(view, event) {
    if (!selectedBlocks(view.state))
        return false;
    const mod = event.metaKey || event.ctrlKey;
    if (event.key === "Backspace" || event.key === "Delete") {
        const tr = deleteSelectedBlocks(view.state);
        if (tr)
            view.dispatch(tr);
        return true;
    }
    if (mod && event.key.toLowerCase() === "x") {
        // Copy is handled by ProseMirror as a text selection over the same range. Only deletion is done per line.
        document.execCommand("copy");
        const tr = deleteSelectedBlocks(view.state);
        if (tr)
            view.dispatch(tr);
        return true;
    }
    if (mod || event.key === "Shift" || event.key === "Alt" || event.key === "Meta" || event.key === "Control")
        return false; // copy, undo, select all, etc. are left as is
    if (event.key === "Escape") {
        clearBlockSelection(view);
        return true;
    }
    if (event.key.startsWith("Arrow")) {
        clearBlockSelection(view);
        return false;
    }
    // Text, Enter, etc.: block partially overwriting text across several lines and just clear the selection.
    clearBlockSelection(view);
    return true;
}
const MARQUEE_THRESHOLD = 4;
/** Whether x is outside the left or right of the body column (the editor minus its inner padding). Marquee selection starts only here. */
export function isOutsideContentColumn(view, clientX) {
    const rect = view.dom.getBoundingClientRect();
    const style = getComputedStyle(view.dom);
    const left = rect.left + (Number.parseFloat(style.paddingLeft) || 0);
    const right = rect.right - (Number.parseFloat(style.paddingRight) || 0);
    return clientX < left || clientX > right;
}
export function createBlockSelectionPlugin() {
    return new Plugin({
        key: cmsBlockSelectionKey,
        state: {
            init: () => null,
            apply(tr, value) {
                const meta = tr.getMeta(cmsBlockSelectionKey);
                if (meta !== undefined)
                    return meta;
                const moved = tr.getMeta(MOVED_BLOCKS_META);
                if (moved?.length)
                    return normalize(tr.doc, moved);
                if (!value)
                    return null;
                // Any other selection change clears the block selection (a block selection continues only via marquee and handle moves).
                if (tr.selectionSet)
                    return null;
                // Document changes unrelated to selection (e.g. adding a trailing empty paragraph) just have the positions follow.
                if (!tr.docChanged)
                    return value;
                const mapped = normalize(tr.doc, value.map((pos) => tr.mapping.map(pos, 1)));
                return mapped.length ? mapped : null;
            },
        },
        props: {
            attributes: (state) => (selectedBlocks(state) ? { class: BLOCK_RANGE_CLASS } : {}),
            decorations: decorationsFor,
            handleKeyDown: handleBlockSelectionKey,
            handleDOMEvents: {
                mousedown(view, event) {
                    // Pressing the editor's own left/right margin (outside the body column) starts a marquee selection. It must be handled here so that
                    // ProseMirror does not also move the text cursor on the same press.
                    if (event.target === view.dom && isOutsideContentColumn(view, event.clientX)) {
                        startMarquee(view, event);
                        return true;
                    }
                    // Pressing the body (starting a text selection) clears the block selection.
                    clearBlockSelection(view);
                    return false;
                },
            },
        },
    });
}
/**
 * The lines a marquee can select and their vertical positions (document order). A top-level block is a line, and in lists each item is a line.
 * An item line's height considers only the item's first block (the text line) — including indented children would select the parent when only a child is covered.
 */
function rowsOf(view) {
    const rows = [];
    const rectOf = (pos) => {
        const dom = view.nodeDOM(pos);
        return dom instanceof HTMLElement ? dom.getBoundingClientRect() : null;
    };
    const addList = (list, listPos) => {
        list.forEach((item, itemOffset) => {
            const itemPos = listPos + 1 + itemOffset;
            const line = rectOf(itemPos + 1) ?? rectOf(itemPos);
            if (line)
                rows.push({ pos: itemPos, top: line.top, bottom: line.bottom });
            item.forEach((child, childOffset) => {
                if (LIST_NODES.has(child.type.name))
                    addList(child, itemPos + 1 + childOffset);
            });
        });
    };
    view.state.doc.forEach((node, offset) => {
        if (LIST_NODES.has(node.type.name)) {
            addList(node, offset);
            return;
        }
        const rect = rectOf(offset);
        if (rect)
            rows.push({ pos: offset, top: rect.top, bottom: rect.bottom });
    });
    return rows;
}
/** The nearest scrollable ancestor (the document if none). The marquee scrolls it when it reaches the screen edge. */
function scrollParentOf(element) {
    let current = element.parentElement;
    while (current) {
        const { overflowY } = getComputedStyle(current);
        if ((overflowY === "auto" || overflowY === "scroll") && current.scrollHeight > current.clientHeight)
            return current;
        current = current.parentElement;
    }
    return document.scrollingElement ?? document.documentElement;
}
const AUTO_SCROLL_EDGE = 48;
const AUTO_SCROLL_MAX_SPEED = 18;
/**
 * Starts a marquee (box) selection. Pressing and dragging in the margin outside the body draws a box and selects the lines
 * that overlap the box's vertical range (continuously from the first to the last line, without skipping lines between). Scrolls when it reaches the top or bottom of the screen.
 * A small movement then release (a click) does nothing.
 */
export function startMarquee(view, event) {
    if (event.button !== 0)
        return;
    event.preventDefault();
    const scroller = scrollParentOf(view.dom);
    const isDocumentScroller = scroller === document.scrollingElement || scroller === document.documentElement;
    // The start point is remembered in content coordinates independent of scrolling (so the box stays attached to the start point during auto-scroll).
    const startScroll = scroller.scrollTop;
    const startX = event.clientX;
    const startY = event.clientY;
    let pointerX = startX;
    let pointerY = startY;
    let box = null;
    let moved = false;
    let frame = 0;
    const render = () => {
        const scrolled = scroller.scrollTop - startScroll;
        const anchorY = startY - scrolled; // current on-screen position of the start point
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
    // Near the top or bottom edge of the screen (scroll area), scroll faster the closer it is.
    const autoScroll = () => {
        const area = isDocumentScroller ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect();
        const speed = pointerY < area.top + AUTO_SCROLL_EDGE
            ? -Math.ceil(((area.top + AUTO_SCROLL_EDGE - pointerY) / AUTO_SCROLL_EDGE) * AUTO_SCROLL_MAX_SPEED)
            : pointerY > area.bottom - AUTO_SCROLL_EDGE
                ? Math.ceil(((pointerY - (area.bottom - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE) * AUTO_SCROLL_MAX_SPEED)
                : 0;
        if (speed !== 0) {
            const before = scroller.scrollTop;
            scroller.scrollTop += speed;
            if (scroller.scrollTop !== before)
                render();
        }
        frame = requestAnimationFrame(autoScroll);
    };
    const move = (moveEvent) => {
        pointerX = moveEvent.clientX;
        pointerY = moveEvent.clientY;
        if (!moved && Math.hypot(pointerX - startX, pointerY - startY) < MARQUEE_THRESHOLD)
            return;
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
        if (!moved)
            return;
        // Swallow once the click that fires when the drag ends, so it is not treated as a click outside the editor (move to end) that clears the selection.
        const swallow = (clickEvent) => {
            clickEvent.stopPropagation();
            clickEvent.preventDefault();
        };
        window.addEventListener("click", swallow, { capture: true, once: true });
        // The click comes right after mouseup. If it did not come (released outside the area), clear the swallow so it does not eat the next click.
        setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
        if (selectedBlocks(view.state))
            view.focus();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
}
