/**
 * The allowed blocks and marks of a body. One list in the schema (`body` of a collection) read by the editor (toolbar, slash menu, insert menu, input
 * rules, paste) and by validation, so they cannot disagree. A body field without a list allows everything.
 *
 * The list only limits what a writer can **add**. A body that already holds a block or mark that is not allowed keeps it: the editor opens it, shows it
 * and saves it unchanged. Validation reports what the list does not allow as a warning on every save and publish, and never rejects a write: the editor
 * (menus, input rules, paste) is what keeps new content inside the list.
 */
/** The heading levels a body can hold. */
export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6];
/**
 * Names of the core blocks a body list can hold. `table`, `math`, `image`, `file` and `text-align` are also the names of their block definitions; the rest
 * are built into the document model. Footnotes cover the reference and the definition.
 */
export const CORE_BODY_BLOCKS = [
    "table",
    "taskList",
    "math",
    "image",
    "file",
    "codeBlock",
    "blockquote",
    "horizontalRule",
    "footnotes",
    "text-align",
];
/** Names of the core marks a body list can hold, as they are stored. */
export const CORE_BODY_MARKS = [
    "bold",
    "italic",
    "strike",
    "underline",
    "code",
    "link",
    "superscript",
    "subscript",
];
/** Marks that are never limited: the translation note is part of the translation flow, not of what a writer formats. */
const ALWAYS_MARKS = new Set(["untranslated"]);
/** A block that exists only inside another one (a table row, a tab, a column): it is allowed when its parent is. */
const isChildBlock = (site, block) => block.parent !== undefined || site.BLOCKS.some((other) => other.children?.blocks?.includes(block.name));
/** The names a body list of this site can hold. */
export function bodyVocabulary(site) {
    const core = new Set(CORE_BODY_BLOCKS);
    const marks = site.ADDED_BLOCKS.filter((block) => block.syntax.kind === "text").map((block) => block.name);
    const blocks = site.ADDED_BLOCKS.filter((block) => block.syntax.kind !== "text" && !core.has(block.name) && !isChildBlock(site, block)).map((block) => block.name);
    return { blocks: [...CORE_BODY_BLOCKS, ...blocks], marks: [...CORE_BODY_MARKS, ...marks] };
}
/**
 * Checks the body list of a collection against what the site can name. A name that is not a block or mark of the site is an error, so a typo does not
 * silently leave a block allowed (or disallowed).
 */
export function validateBodyAllowed(collection, allowed, site) {
    if (allowed === undefined)
        return;
    const at = `cms.config: ${collection}.body`;
    const vocabulary = bodyVocabulary(site);
    const check = (key, known) => {
        const list = allowed[key];
        if (list === undefined)
            return;
        if (!Array.isArray(list))
            throw new Error(`${at}.${key} must be an array of names`);
        const seen = new Set();
        for (const name of list) {
            if (typeof name !== "string")
                throw new Error(`${at}.${key} must be an array of names`);
            if (!known.includes(name)) {
                throw new Error(`${at}.${key} has unknown ${key === "blocks" ? "block" : "mark"} "${name}"; use one of: ${known.join(", ")}`);
            }
            if (seen.has(name))
                throw new Error(`${at}.${key} lists "${name}" twice`);
            seen.add(name);
        }
    };
    check("blocks", vocabulary.blocks);
    check("marks", vocabulary.marks);
    const { headings } = allowed;
    if (headings !== undefined) {
        if (!Array.isArray(headings) || headings.some((level) => !HEADING_LEVELS.includes(level))) {
            throw new Error(`${at}.headings must be an array of heading levels (${HEADING_LEVELS.join(", ")})`);
        }
        if (new Set(headings).size !== headings.length)
            throw new Error(`${at}.headings lists a level twice`);
    }
}
/** The rules of a body list. `undefined` (no list) allows everything. */
export function bodyRules(allowed) {
    const blocks = allowed?.blocks === undefined ? undefined : new Set(allowed.blocks);
    const marks = allowed?.marks === undefined ? undefined : new Set(allowed.marks);
    const headings = allowed?.headings === undefined ? undefined : new Set(allowed.headings);
    return {
        limited: blocks !== undefined || marks !== undefined || headings !== undefined,
        allowsBlock: (name) => blocks === undefined || blocks.has(name),
        allowsMark: (name) => marks === undefined || marks.has(name) || ALWAYS_MARKS.has(name),
        allowsHeading: (level) => headings === undefined || headings.has(level),
    };
}
const isTaskList = (node) => node.type === "bulletList" &&
    (node.content ?? []).length > 0 &&
    (node.content ?? []).every((item) => item.type === "listItem" && typeof item.attrs?.checked === "boolean");
/**
 * The name a stored node has in a body list, or `undefined` for what a list does not govern (paragraphs, lists, line breaks, the rows and cells of a table, the
 * children of a container, JSX no definition describes).
 */
export function listedBlockName(site, node) {
    switch (node.type) {
        case "table":
        case "math":
        case "image":
        case "file":
        case "codeBlock":
        case "blockquote":
        case "horizontalRule":
            return node.type;
        case "text-align":
            return "text-align";
        case "footnoteReference":
        case "footnoteDefinition":
            return "footnotes";
        case "bulletList":
            return isTaskList(node) ? "taskList" : undefined;
        case "heading":
        case "paragraph":
        case "orderedList":
        case "listItem":
        case "tableRow":
        case "tableCell":
        case "hardBreak":
        case "text":
        case "mdxJsx":
        case "mdxEsm":
        case "mdxExpression":
        case "html":
        case "unparsed":
            return undefined;
        default: {
            const block = site.BLOCK_BY_NAME.get(node.type);
            if (!block || block.syntax.kind === "text" || isChildBlock(site, block))
                return undefined;
            return block.name;
        }
    }
}
/**
 * Every block and mark of a stored document that its list does not allow, in document order: one item per block, and one per mark in each block that holds
 * text with it. Reads the stored document only, so it gives the same answer whichever notation or API the body came from.
 */
export function disallowedInDocument(site, allowed, doc) {
    const rules = bodyRules(allowed);
    if (!rules.limited)
        return [];
    const found = [];
    const content = "content" in doc ? doc.content : doc;
    const visit = (node, parentId) => {
        if (node.text !== undefined)
            return;
        const blockId = node.id ?? parentId;
        const at = blockId === undefined ? {} : { blockId };
        if (node.type === "heading") {
            const level = typeof node.attrs?.level === "number" ? node.attrs.level : 2;
            if (!rules.allowsHeading(level))
                found.push({ kind: "block", name: "heading", level, ...at });
        }
        else {
            const name = listedBlockName(site, node);
            if (name !== undefined && !rules.allowsBlock(name))
                found.push({ kind: "block", name, ...at });
        }
        const children = node.content ?? [];
        const marksHere = new Set();
        for (const child of children) {
            for (const mark of child.marks ?? []) {
                if (!rules.allowsMark(mark.type) && !marksHere.has(mark.type)) {
                    marksHere.add(mark.type);
                    found.push({ kind: "mark", name: mark.type, ...at });
                }
            }
        }
        for (const child of children)
            visit(child, blockId);
    };
    for (const node of content)
        visit(node, undefined);
    return found;
}
