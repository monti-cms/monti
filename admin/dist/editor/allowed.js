import { bodyRules, bodyVocabulary, CORE_BODY_MARKS, HEADING_LEVELS, } from "@monti-cms/core/client";
import { addedMarkByEditorName } from "./added-marks.js";
import { addedBlockOfNode } from "./blocks/added/shared.js";
/** Tiptap node names of the core blocks, by the name they have in the list. */
const CORE_NODE_BLOCKS = {
    table: "table",
    tableRow: "table",
    tableHeader: "table",
    tableCell: "table",
    taskList: "taskList",
    taskItem: "taskList",
    cmsMath: "math",
    image: "image",
    cmsFile: "file",
    codeBlock: "codeBlock",
    blockquote: "blockquote",
    horizontalRule: "horizontalRule",
    footnoteReference: "footnotes",
    footnoteDefinition: "footnotes",
    // The alignment attribute of paragraphs and headings (an extension with no node of its own).
    textAlign: "text-align",
};
const CORE_MARKS = new Set(CORE_BODY_MARKS);
const build = (site, allowed) => {
    const rules = bodyRules(allowed);
    const blocks = new Set(bodyVocabulary(site).blocks);
    const blockOfNode = (name) => {
        const core = CORE_NODE_BLOCKS[name];
        if (core !== undefined)
            return core;
        const block = addedBlockOfNode(site, name);
        return block && blocks.has(block.name) ? block.name : undefined;
    };
    const markOfEditorMark = (name) => CORE_MARKS.has(name) ? name : addedMarkByEditorName(site).get(name)?.name;
    return {
        limited: rules.limited,
        rules,
        allowsBlock: rules.allowsBlock,
        allowsMark: rules.allowsMark,
        allowsHeading: rules.allowsHeading,
        allowsNode: (name) => {
            if (name === "heading")
                return HEADING_LEVELS.some((level) => rules.allowsHeading(level));
            const block = blockOfNode(name);
            return block === undefined || rules.allowsBlock(block);
        },
        allowsEditorMark: (name) => {
            const mark = markOfEditorMark(name);
            return mark === undefined || rules.allowsMark(mark);
        },
        blockOfNode,
        markOfEditorMark,
    };
};
/** An editor with no list: everything is allowed. */
export const OPEN_ALLOWANCE = {
    limited: false,
    rules: bodyRules(undefined),
    allowsBlock: () => true,
    allowsMark: () => true,
    allowsHeading: () => true,
    allowsNode: () => true,
    allowsEditorMark: () => true,
    blockOfNode: () => undefined,
    markOfEditorMark: () => undefined,
};
const cache = new WeakMap();
/**
 * What the editor offers for a body list. The same object for the same site and list, so the extensions built from it stay the same between renders.
 * Without a list, or one that limits nothing, everything is allowed.
 */
export function editorAllowance(site, allowed) {
    if (!allowed || !bodyRules(allowed).limited)
        return OPEN_ALLOWANCE;
    let bySite = cache.get(site);
    if (!bySite) {
        bySite = new WeakMap();
        cache.set(site, bySite);
    }
    let allowance = bySite.get(allowed);
    if (!allowance) {
        allowance = build(site, allowed);
        bySite.set(allowed, allowance);
    }
    return allowance;
}
