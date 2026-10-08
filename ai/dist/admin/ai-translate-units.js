import { BLOCK_ID_ATTRIBUTE, findBlock as findBlockById, UNTRANSLATED_MARK_NAME } from "@monti-cms/admin/editor";
import { Fragment } from "@tiptap/pm/model";
import { contentOfText, textOfContent } from "./mdx-format.js";
/**
 * Units of AI translation. A unit is the single block a block handle points to, or the blocks that Translate all collects.
 *
 * - A list item is a unit. An item alone is not valid MDX, so it is wrapped in a list of the same kind (one item) before sending,
 *   and the item is taken from the returned list to replace only that item's position.
 * - Blocks inside callouts, quotes and tabs are valid MDX on their own, so they are sent as they are.
 * - When replacing, it checks that the result fits the same position in the same shape. If not, nothing is replaced (lists are not split).
 */
const LISTS = new Set(["bulletList", "orderedList", "taskList"]);
const LIST_ITEMS = new Set(["listItem", "taskItem"]);
/** Whether a translation notice remains in the block. */
export function hasHints(node) {
    let found = false;
    node.descendants((child) => {
        if (found)
            return false;
        if (child.marks.some((mark) => mark.type.name === UNTRANSLATED_MARK_NAME))
            found = true;
        return !found;
    });
    return found;
}
/** JSON with the notice markers stripped. The notice text is the original, so this is the source block itself. */
const withoutHints = (json) => ({
    ...json,
    ...(json.marks ? { marks: json.marks.filter((mark) => mark.type !== UNTRANSLATED_MARK_NAME) } : {}),
    ...(json.content ? { content: json.content.map(withoutHints) } : {}),
});
/** Source MDX of a block (JSON), written by the `mdx` format. */
export const sourceMdxFromJson = (site, format, json) => textOfContent(site, format, [withoutHints(json)]);
/** Translation unit of one block. `parent` is the node that contains the block. */
export function unitOf(site, format, node, parent) {
    const json = node.toJSON();
    const wrap = LIST_ITEMS.has(node.type.name) && parent && LISTS.has(parent.type.name) ? parent : null;
    const sent = wrap ? { type: wrap.type.name, attrs: wrap.attrs, content: [json] } : json;
    return { mdx: sourceMdxFromJson(site, format, sent), original: JSON.stringify(json), wrap: wrap?.type.name ?? null };
}
/** Translation unit at a block handle position (`pos` is right before the block). `null` if there is no notice. */
export function unitAt(site, format, doc, pos) {
    const node = doc.nodeAt(pos);
    if (!node || !node.isBlock || !hasHints(node))
        return null;
    return unitOf(site, format, node, doc.resolve(pos).parent);
}
/** Units of Translate all. One per top-level block, and one per item for lists. */
export function collectUnits(site, format, doc) {
    const units = [];
    doc.forEach((node) => {
        if (!hasHints(node))
            return;
        if (LISTS.has(node.type.name)) {
            node.forEach((item) => {
                if (hasHints(item))
                    units.push(unitOf(site, format, item, node));
            });
        }
        else
            units.push(unitOf(site, format, node, doc));
    });
    return units;
}
/** The block id the original block had (the editor's `blockId`), if any. */
const blockIdOf = (original) => {
    const id = JSON.parse(original).attrs?.[BLOCK_ID_ATTRIBUTE];
    return typeof id === "string" ? id : undefined;
};
/**
 * Position of the original block. A block with an id is found by it, and only while it is unchanged (the same JSON). Otherwise the
 * `hint` position is checked first, then the document is searched for a block with the same JSON.
 */
function findBlock(doc, original, hint) {
    const id = blockIdOf(original);
    if (id !== undefined) {
        const pos = findBlockById(doc, id);
        const node = pos === undefined ? null : doc.nodeAt(pos);
        return node && JSON.stringify(node.toJSON()) === original ? { pos: pos, size: node.nodeSize } : null;
    }
    const at = hint !== null && hint < doc.content.size ? doc.nodeAt(hint) : null;
    if (at && JSON.stringify(at.toJSON()) === original)
        return { pos: hint, size: at.nodeSize };
    let found = null;
    doc.descendants((node, pos) => {
        if (found)
            return false;
        if (node.isBlock && JSON.stringify(node.toJSON()) === original) {
            found = { pos, size: node.nodeSize };
            return false;
        }
        return true;
    });
    return found;
}
/**
 * Replaces the original block with the translation result. If the block changed in the meantime, `changed`; if the result does not fit that position,
 * `invalid`; in both cases the document is untouched.
 */
export function applyTranslation(site, format, editor, unit, mdx, hint) {
    const { state } = editor;
    const target = findBlock(state.doc, unit.original, hint);
    if (!target)
        return "changed";
    let content = contentOfText(site, format, mdx);
    if (unit.wrap) {
        const [list] = content;
        if (content.length !== 1 || list?.type !== unit.wrap || list.content?.length !== 1)
            return "invalid";
        content = list.content;
    }
    // The translated block is the same block: it keeps the original's id (blocks it was split into get new ones).
    const id = blockIdOf(unit.original);
    const [first] = content;
    if (id !== undefined && first)
        content = [{ ...first, attrs: { ...(first.attrs ?? {}), [BLOCK_ID_ATTRIBUTE]: id } }, ...content.slice(1)];
    let nodes;
    try {
        nodes = content.map((json) => state.schema.nodeFromJSON(json));
        for (const node of nodes)
            node.check();
    }
    catch {
        return "invalid";
    }
    const $pos = state.doc.resolve(target.pos);
    const index = $pos.index();
    const fragment = Fragment.fromArray(nodes);
    if (nodes.length === 0 || !$pos.parent.canReplace(index, index + 1, fragment))
        return "invalid";
    editor.view.dispatch(state.tr.replaceWith(target.pos, target.pos + target.size, fragment));
    return "replaced";
}
