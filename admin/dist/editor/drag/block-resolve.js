import { CONTAINER_NODE_NAMES, PARENT_ONLY_NODE_NAMES } from "../blocks/added/shared.js";
/**
 * Block element resolution rules and DOM traversal.
 * Handles top-level blocks, nested blocks (list items, inside blockquotes), and NodeView containers (content hole) under common rules.
 */
/**
 * Names of container nodes whose child blocks can be moved one at a time: blockquote plus added container blocks (callout, fold, tabs, columns, etc.).
 * Children of parents not in this list (table cells, etc.) are not moved separately; the parent block moves as a unit.
 */
export const DRAG_CONTAINER_NODES = new Set(["blockquote", ...CONTAINER_NODE_NAMES]);
const isContentHole = (element) => !!element &&
    (element.hasAttribute("data-node-view-content") ||
        element.hasAttribute("data-node-view-content-react") ||
        element.classList.contains("ProseMirror-content"));
const isListElement = (element) => element.tagName === "UL" || element.tagName === "OL" || element.getAttribute("data-type") === "taskList";
const isListItemElement = (element) => element.tagName === "LI" || element.getAttribute("data-type") === "taskItem";
/**
 * NodeViews not descended into (code block). Inside the contentDOM are text fragments, not blocks, so descending would show
 * a handle for every code line. The whole block is treated as one target.
 */
const LEAF_VIEW_SELECTOR = ".node-codeBlock";
/** Frames whose child blocks cannot be moved separately (a single column, a single tab). Never a handle target. */
const STRUCTURAL_VIEWS = [...PARENT_ONLY_NODE_NAMES].map((name) => `node-${name}`);
const isStructural = (element) => STRUCTURAL_VIEWS.some((name) => element.classList.contains(name));
/** The contentDOM of a NodeView (container). Skips those of inner containers. */
const contentHoleOf = (view) => Array.from(view.querySelectorAll("[data-node-view-content-react]")).find((hole) => hole.closest(".react-renderer") === view) ?? null;
/** Child blocks of a block that can be split into finer lines. null if it cannot be split further. */
const childBlocksOf = (element) => {
    const children = (parent) => Array.from(parent.children).filter((child) => child instanceof HTMLElement && child.getBoundingClientRect().height > 0);
    if (isListElement(element))
        return children(element).filter(isListItemElement);
    // For a list item, only the indented list is split out separately (the item's paragraph is the same target as the item).
    if (isListItemElement(element))
        return children(element).filter(isListElement);
    if (element.matches(LEAF_VIEW_SELECTOR))
        return null;
    if (element.classList.contains("react-renderer")) {
        const hole = contentHoleOf(element);
        return hole ? children(hole) : null;
    }
    return null;
};
const verticalGap = (child, clientY) => {
    const rect = child.getBoundingClientRect();
    return clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
};
/**
 * The child spanning that line (clientY). Side-by-side children (columns) are picked by clientX; in a gap, the nearer one.
 * With `nearestRow`, a line that spans no child (the gap between list items) also picks the nearest child.
 */
const childAt = (children, clientX, clientY, nearestRow = false) => {
    const rows = children.filter((child) => verticalGap(child, clientY) === 0);
    if (rows.length === 0 && nearestRow && children.length > 0)
        return children.reduce((nearest, child) => verticalGap(child, clientY) < verticalGap(nearest, clientY) ? child : nearest);
    if (rows.length <= 1)
        return rows[0] ?? null;
    const gap = (child) => {
        const rect = child.getBoundingClientRect();
        return clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
    };
    return rows.reduce((nearest, child) => (gap(child) < gap(nearest) ? child : nearest));
};
/**
 * To keep one handle per line, narrow the pointed block down to the innermost block on that line.
 * - A list (indentation, bullet area) goes to the item at that height, and for an indented list down to the inner item.
 * - The frame and margin of a container (callout, fold, tabs, columns) go down to the inner block at that height. Only for a line
 *   with no inner block (title row, top/bottom margin) is the container itself the target.
 * - A single column or tab is not a target. For a line with no inner block, grab the outer container (column split, tabs).
 * Otherwise, when the mouse moves between the frame and the text, the handle of the same line alternates between two positions.
 */
export function refineBlock(block, clientX, clientY) {
    let current = block;
    for (let depth = 0; depth < 32; depth += 1) {
        const children = childBlocksOf(current);
        // A list has no title row. The gap between items also picks the nearest item (so the whole-list handle does not show on the first item's line).
        const hit = children ? childAt(children, clientX, clientY, isListElement(current)) : null;
        if (hit) {
            current = hit;
            continue;
        }
        if (isStructural(current)) {
            const parent = current.parentElement?.closest(".react-renderer");
            if (parent)
                return parent;
        }
        return current;
    }
    return current;
}
/**
 * Finds the block-level DOM element the handle attaches to, starting from the given DOM element.
 * - Top-level block: a direct child of the editor root
 * - List item: <li> and [data-type="taskItem"]
 * - Blockquote: the whole blockquote even when pointing inside
 * - Inside a container NodeView: a direct child block of [data-node-view-content] (content hole)
 * - The container NodeView itself: when hovering the header/padding outside the contentDOM
 */
export function findBlockDOM(root, target) {
    if (!target || !root.contains(target) || target === root)
        return null;
    // A blockquote moves as one unit. A handle on the inner paragraph would overlap the blockquote's left line and give two handles on one line.
    const quote = target.closest("blockquote");
    const leaf = target.closest(LEAF_VIEW_SELECTOR);
    let current = quote && root.contains(quote) ? quote : leaf && root.contains(leaf) ? leaf : target;
    while (current && current !== root) {
        const parent = current.parentElement;
        if (!parent)
            break;
        // 1. A direct child of the editor root is a top-level block
        if (parent === root) {
            return current;
        }
        // 2. List item (li under ul/ol)
        if (current.tagName === "LI" || current.getAttribute("data-type") === "taskItem") {
            return current;
        }
        // 4. Direct child block of the content hole of a container NodeView. Tiptap React puts an actual contentDOM
        // (`data-node-view-content-react`) one level inside `data-node-view-content`, so both are treated as the content hole.
        if (isContentHole(parent)) {
            return current;
        }
        // 5. Direct area of the container NodeView wrapper (data-node-view-wrapper) (header/background, etc.)
        if (parent.hasAttribute("data-node-view-wrapper")) {
            if (!current.hasAttribute("data-node-view-content")) {
                let wrapper = parent;
                while (wrapper && wrapper.parentElement !== root && !isContentHole(wrapper.parentElement)) {
                    wrapper = wrapper.parentElement;
                }
                if (wrapper)
                    return wrapper;
            }
        }
        current = parent;
    }
    return current !== root ? current : null;
}
/**
 * Finds the move-target block that a document position points to.
 * - List item (listItem / taskItem): align depth to the listItem level and move the whole item as a unit.
 * - Block inside a blockquote / container: move by child block.
 * - Top-level block: move by depth 1 block.
 */
export function targetBlockAt(doc, pos) {
    if (doc.childCount === 0)
        return null;
    const safePos = Math.max(0, Math.min(pos, doc.content.size));
    const $pos = doc.resolve(safePos);
    // A position right before a block (posAtDOM of an atom block, whole-block selection, block start passed by the handle menu) targets that block.
    // A block inside a list item moves as the item (see 1 below).
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
        // Between blocks, such as at the document end: the nearest top-level block.
        const index = Math.min($pos.index(0), doc.childCount - 1);
        let start = 0;
        for (let i = 0; i < index; i++)
            start += doc.child(i).nodeSize;
        const node = doc.child(index);
        return { node, start, end: start + node.nodeSize, depth: 1, index, parent: doc };
    }
    // 1. Check list item (listItem, taskItem)
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
    // 2. Check blockquote or block inside a container
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
    // 3. Top-level block (depth 1)
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
 * Computes the ProseMirror position and block info from the found block DOM element.
 */
export function resolveTargetBlock(view, blockEl) {
    try {
        const pos = view.posAtDOM(blockEl, 0);
        const rect = blockEl.getBoundingClientRect();
        // Find the node this DOM directly renders. For a NodeView (container, single column), posAtDOM points to the inner first child,
        // so the handle sits beside the container but only the first block moves, a mismatch.
        const $pos = view.state.doc.resolve(pos);
        for (let depth = $pos.depth; depth >= 1; depth -= 1) {
            const start = $pos.before(depth);
            if (view.nodeDOM(start) === blockEl)
                return { pos: start, node: $pos.node(depth), rect };
        }
        if ($pos.nodeAfter && view.nodeDOM(pos) === blockEl)
            return { pos, node: $pos.nodeAfter, rect };
        const target = targetBlockAt(view.state.doc, pos);
        if (target) {
            return { pos: target.start, node: target.node, rect };
        }
        return null;
    }
    catch {
        return null;
    }
}
