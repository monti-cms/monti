import { formatMeta } from "../../code-block/meta.js";
import { addedNodeBlocks, blockNodeName, childBlocksOf, defaultValues, isContainer, isFence } from "./shared.js";
const paragraph = (text) => text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" };
const codeBlockContent = ({ language, title, code }) => ({
    type: "codeBlock",
    attrs: { language, meta: formatMeta({ title }) },
    ...(code ? { content: [{ type: "text", text: code }] } : {}),
});
const directiveContent = (block, initial, children) => {
    const codeBlocks = initial?.codeBlocks;
    const body = children.length > 0 ? children : codeBlocks?.length ? codeBlocks.map(codeBlockContent) : [paragraph(initial?.text)];
    return {
        type: blockNodeName(block),
        attrs: { values: initial?.values ?? defaultValues(block) },
        ...(isContainer(block) ? { content: body } : {}),
    };
};
/**
 * The node to insert from the slash menu. Follows the definition's `editor.insert` (initial value); if absent, uses attribute defaults and an empty body. If child block rules
 * exist, uses the children of the initial value; if absent, inserts as many first child blocks as the minimum count (one if there is no minimum).
 * A body container starts with the initial value's code blocks (`codeBlocks`) if it has any, otherwise with one paragraph.
 */
export function insertContentOf(site, block) {
    const all = addedNodeBlocks(site);
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
export const addedBlockInsertActions = (site) => Object.fromEntries(addedNodeBlocks(site)
    .filter((block) => !block.parent)
    .map((block) => [
    block.name,
    (editor, range) => editor.chain().focus().deleteRange(range).insertContent(insertContentOf(site, block)).run(),
]));
