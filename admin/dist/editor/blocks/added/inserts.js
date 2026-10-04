import { ADDED_NODE_BLOCKS, blockNodeName, childBlocksOf, defaultValues, isContainer, isFence } from "./shared.js";
const paragraph = (text) => text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" };
const directiveContent = (block, initial, children) => ({
    type: blockNodeName(block),
    attrs: { values: initial?.values ?? defaultValues(block), originalAttributes: [] },
    ...(isContainer(block) ? { content: children.length > 0 ? children : [paragraph(initial?.text)] } : {}),
});
/**
 * The node to insert from the slash menu. Follows the definition's `editor.insert` (initial value); if absent, uses attribute defaults and an empty body. If child block rules
 * exist, uses the children of the initial value; if absent, inserts as many first child blocks as the minimum count (one if there is no minimum).
 */
export function insertContentOf(block, all = ADDED_NODE_BLOCKS) {
    const insert = block.editor.insert;
    if (isFence(block) && block.syntax.kind === "fence") {
        return { type: blockNodeName(block), attrs: { value: insert?.code ?? "", language: block.syntax.lang } };
    }
    const [firstChild] = childBlocksOf(block, all);
    const children = firstChild
        ? (insert?.children ?? Array.from({ length: Math.max(block.children?.min ?? 1, 1) }, () => undefined)).map((initial) => directiveContent(firstChild, initial, []))
        : [];
    return directiveContent(block, insert, children);
}
/** Insert actions of added blocks (slash menu). The key is the block name. */
export const ADDED_BLOCK_INSERT_ACTIONS = Object.fromEntries(ADDED_NODE_BLOCKS.filter((block) => !block.parent).map((block) => [
    block.name,
    (editor, range) => editor.chain().focus().deleteRange(range).insertContent(insertContentOf(block)).run(),
]));
