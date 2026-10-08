import { perSite } from "@monti-cms/core/client";
import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { BlockNodeView } from "../block-node-view.js";
import { addedNodeBlocks, BODY_CONTAINER_GROUP, blockNodeName, CONTAINER_GROUP, childBlocksOf, isBodyContainer, isContainer, isFence, PARENT_ONLY_VIEW_CLASS, } from "./shared.js";
const parseJson = (value, fallback) => {
    try {
        return value ? JSON.parse(value) : fallback;
    }
    catch {
        return fallback;
    }
};
/** Node content expression built from the child block rules (e.g. `cmsTab{2,8}`). */
const childContent = (block, all) => {
    const names = childBlocksOf(block, all).map(blockNodeName);
    if (names.length === 0)
        return "block+";
    const min = block.children?.min ?? 1;
    const max = block.children?.max;
    const choice = names.length === 1 ? names[0] : `(${names.join(" | ")})`;
    return `${choice}{${min},${max ?? ""}}`;
};
/** Code fence block node. The code is `value`; the fence language and meta are preserved as is. */
function createFenceNode(block) {
    return Node.create({
        name: blockNodeName(block),
        group: "block",
        atom: true,
        draggable: true,
        selectable: true,
        addAttributes() {
            return { value: { default: "" }, meta: { default: "" }, language: { default: block.syntax.lang } };
        },
        parseHTML() {
            return [{ tag: `div[data-cms-fence="${block.syntax.lang}"]` }];
        },
        renderHTML({ HTMLAttributes }) {
            return ["div", mergeAttributes(HTMLAttributes, { "data-cms-fence": block.syntax.lang })];
        },
        addNodeView() {
            return ReactNodeViewRenderer(BlockNodeView);
        },
    });
}
/**
 * Tiptap node for a single added block. A container holds body content (or fixed child blocks); single-line blocks and code fence blocks are selected
 * as a whole. The edit view is chosen by `BlockNodeView`.
 */
export function createAddedBlockNode(block, all) {
    if (isFence(block))
        return createFenceNode(block);
    const content = isContainer(block) ? childContent(block, all) : undefined;
    const groups = [
        ...(block.parent ? [] : ["block"]),
        ...(content ? [CONTAINER_GROUP] : []),
        ...(content && isBodyContainer(block) ? [BODY_CONTAINER_GROUP] : []),
    ].join(" ");
    return Node.create({
        name: blockNodeName(block),
        // Parent-only blocks are placed only inside their parent. The container groups tell the drag and block commands what the node is (see `CONTAINER_GROUP`).
        ...(groups ? { group: groups } : {}),
        ...(content ? { content, isolating: true } : { atom: true }),
        selectable: true,
        // Dragged via the handle overlay. It does not compete with body selection.
        draggable: false,
        addAttributes() {
            return {
                values: {
                    default: {},
                    parseHTML: (element) => parseJson(element.getAttribute("data-cms-values"), {}),
                    renderHTML: (attributes) => ({ "data-cms-values": JSON.stringify(attributes.values ?? {}) }),
                },
            };
        },
        parseHTML() {
            return [{ tag: `div[data-cms-block="${block.name}"]` }];
        },
        renderHTML({ HTMLAttributes }) {
            return content
                ? ["div", mergeAttributes(HTMLAttributes, { "data-cms-block": block.name }), 0]
                : ["div", mergeAttributes(HTMLAttributes, { "data-cms-block": block.name })];
        },
        addNodeView() {
            return ReactNodeViewRenderer(BlockNodeView, block.parent ? { className: PARENT_ONLY_VIEW_CLASS } : undefined);
        },
    });
}
/** All added block nodes of a site. The same list for the same site, so an editor rebuilt for it keeps its extensions. */
export const addedBlockNodes = perSite((site) => addedNodeBlocks(site).map((block) => createAddedBlockNode(block, addedNodeBlocks(site))));
