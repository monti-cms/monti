import { assignBlockIds, forEachBlock } from "./block-ids.js";
import { normalizedLinkMark } from "./entry-links.js";
/**
 * Format version of a stored document. Raise it when a node or attribute changes its name or meaning; only the current version is read. A new kind of
 * block does not raise it.
 */
export const STORED_DOCUMENT_VERSION = 3;
/** Node types of the document model itself. A block definition with one of these names is stored as `mdxJsx` so the two never mix. */
export const CORE_NODE_TYPES = new Set([
    "doc",
    "paragraph",
    "heading",
    "blockquote",
    "bulletList",
    "orderedList",
    "listItem",
    "horizontalRule",
    "footnoteDefinition",
    "footnoteReference",
    "table",
    "tableRow",
    "tableCell",
    "codeBlock",
    "math",
    "image",
    "html",
    "mdxEsm",
    "mdxExpression",
    "mdxJsx",
    "unparsed",
    "text",
    "hardBreak",
]);
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** The value with its object keys sorted at every depth. */
export const sortJson = (value) => {
    if (value === null || typeof value !== "object")
        return value;
    if (Array.isArray(value))
        return value.map(sortJson);
    const out = {};
    for (const key of Object.keys(value).sort()) {
        const member = value[key];
        if (member !== undefined)
            out[key] = sortJson(member);
    }
    return out;
};
export const sortedAttrs = (attrs) => Object.keys(attrs).length > 0 ? sortJson(attrs) : undefined;
/** Builds a node with its keys in sorted order (`attrs`, `content`, `id`, `marks`, `sourceId`, `text`, `type`). */
export const storedNode = (type, attrs, content, marks, text, ids = {}) => {
    const out = {};
    if (attrs && Object.keys(attrs).length > 0)
        out.attrs = sortJson(attrs);
    if (content)
        out.content = content;
    if (ids.id !== undefined)
        out.id = ids.id;
    if (marks && marks.length > 0)
        out.marks = marks;
    if (ids.sourceId !== undefined)
        out.sourceId = ids.sourceId;
    if (text !== undefined)
        out.text = text;
    out.type = type;
    return out;
};
/** A mark in its stored form: keys sorted, an internal link normalised. */
export const storedMark = (given) => {
    const mark = normalizedLinkMark(given);
    const attrs = mark.attrs ? sortedAttrs(mark.attrs) : undefined;
    return attrs ? { attrs, type: mark.type } : { type: mark.type };
};
export const isBlankParagraph = (block) => block.type === "paragraph" && (block.content ?? []).length === 0;
const NODE_KEYS = new Set(["type", "id", "sourceId", "attrs", "content", "marks", "text"]);
const isJsonValue = (value) => {
    if (value === null || typeof value === "string" || typeof value === "boolean")
        return true;
    if (typeof value === "number")
        return Number.isFinite(value);
    if (Array.isArray(value))
        return value.every(isJsonValue);
    return isRecord(value) && Object.values(value).every(isJsonValue);
};
const isMark = (value) => isRecord(value) &&
    typeof value.type === "string" &&
    value.type.length > 0 &&
    Object.keys(value).every((key) => key === "type" || key === "attrs") &&
    (value.attrs === undefined || (isRecord(value.attrs) && isJsonValue(value.attrs)));
const isNode = (value) => isRecord(value) &&
    typeof value.type === "string" &&
    value.type.length > 0 &&
    Object.keys(value).every((key) => NODE_KEYS.has(key)) &&
    (value.attrs === undefined || (isRecord(value.attrs) && isJsonValue(value.attrs))) &&
    (value.content === undefined || (Array.isArray(value.content) && value.content.every(isNode))) &&
    (value.marks === undefined || (Array.isArray(value.marks) && value.marks.every(isMark))) &&
    (value.text === undefined || typeof value.text === "string") &&
    (value.id === undefined || typeof value.id === "string") &&
    (value.sourceId === undefined || typeof value.sourceId === "string");
/**
 * Reads a stored document from JSON (a database column, an API request, an export file): checks its shape and its version. Returns `undefined`
 * for anything that is not a stored document of the current version.
 */
export const readStoredDocument = (value) => {
    if (!isRecord(value) || value.type !== "doc")
        return undefined;
    if (Object.keys(value).some((key) => key !== "type" && key !== "version" && key !== "content"))
        return undefined;
    const version = value.version;
    if (version !== STORED_DOCUMENT_VERSION)
        return undefined;
    if (!Array.isArray(value.content) || !value.content.every(isNode))
        return undefined;
    // Keys are sorted again: a document read from `jsonb` comes back in Postgres' key order.
    return {
        content: value.content.map((item) => sortJson(item)),
        type: "doc",
        version,
    };
};
/** Text runs of one parent as a reader of the text would see them: empty text dropped, neighbours with the same marks joined, marks in their stored order. */
const canonicalInline = (site, content) => {
    const out = [];
    for (const item of content) {
        if (item.text === undefined) {
            out.push(canonicalNode(site, item));
            continue;
        }
        if (item.text.length === 0)
            continue;
        const marks = item.marks && item.marks.length > 0 ? site.sortMarks(item.marks.map(normalizedLinkMark)) : undefined;
        const previous = out.at(-1);
        if (previous?.text !== undefined && JSON.stringify(previous.marks ?? null) === JSON.stringify(marks ?? null)) {
            out[out.length - 1] = { ...previous, text: previous.text + item.text };
            continue;
        }
        out.push(storedNode("text", undefined, undefined, marks, item.text));
    }
    return out;
};
const canonicalNode = (site, item) => item.content ? { ...item, content: canonicalInline(site, item.content) } : item;
/**
 * The form a document is stored in whichever way it was made (a client, an API request, a hook, a format): trailing blank paragraphs dropped, text runs
 * normalised (see `canonicalInline`). A document read from a format is already in it, so the same body hashes the same from either source.
 */
export const canonicalDocument = (site, doc) => {
    const content = canonicalInline(site, doc.content);
    while (content.length > 0 && isBlankParagraph(content[content.length - 1]))
        content.pop();
    return { content, type: "doc", version: doc.version };
};
/** A document with no blocks (a new body, a new template). */
export const emptyStoredDocument = () => ({
    content: [],
    type: "doc",
    version: STORED_DOCUMENT_VERSION,
});
/** Node type of a body that could not become a document (see `unparsedDocument`). */
export const UNPARSED_NODE = "unparsed";
/**
 * The document of a body that could not be read as one (a format rejected the text): a single `unparsed`
 * node that keeps the text as it was given. A draft can hold it and the editor shows it as it is; `unparsed_body` blocks publishing it.
 */
export const unparsedDocument = (source, previous, format = "mdx") => {
    const node = { attrs: { format, source }, type: UNPARSED_NODE };
    return { content: assignBlockIds([node], [previous?.content]), type: "doc", version: STORED_DOCUMENT_VERSION };
};
/** Whether a document holds a body that could not be read (an `unparsed` node anywhere in its blocks). */
export const isUnparsedDocument = (doc) => {
    let found = false;
    forEachBlock(doc.content, (block) => {
        if (block.type === UNPARSED_NODE)
            found = true;
    });
    return found;
};
