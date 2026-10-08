import { assignBlockIds, CORE_NODE_TYPES, copyBlockIds, outOfRangeAnnotationNames, STORED_DOCUMENT_VERSION, storedCodeBlockAttrs, storedMark, storedNode, UNPARSED_NODE, unparsedDocument, withoutBlockIds, workingCodeBlockAttrs, } from "@monti-cms/core/document";
import { analyze } from "./analyze.js";
import { attributeRecord } from "./jsx.js";
import { jsxRegistryOf } from "./registry.js";
import { serialize } from "./serialize.js";
import { toDocument } from "./to-document.js";
/**
 * The stored document and the working document. The stored document is what core keeps (`StoredDocument`); the working document is the JSX-shaped tree
 * `toDocument` makes from MDX and `serialize` writes back. A block with a definition is stored under the definition's name (`callout`), the working
 * document names it by the component that renders it (`Callout`) with a raw attribute list.
 */
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const hasSpread = (attrs) => Array.isArray(attrs?.attributes) && attrs.attributes.some((item) => isRecord(item) && Boolean(item.spread));
/** The definition a working JSX node is stored by, if it is a plain container or leaf block. */
const definitionOf = (site, working) => {
    if (!jsxRegistryOf(site).BLOCK_JSX_NAMES.has(working.type) || hasSpread(working.attrs))
        return undefined;
    const block = site.BLOCK_BY_COMPONENT.get(working.type);
    if (!block || CORE_NODE_TYPES.has(block.name))
        return undefined;
    const kind = block.syntax.kind;
    return kind === "container" || kind === "leaf" ? block : undefined;
};
/** Attribute values of a JSX node: everything but the component name, the raw list and the spread marker. */
const valuesOf = (attrs) => {
    const { name: _name, attributes: _attributes, spread: _spread, ...values } = attrs ?? {};
    return values;
};
/** Raw JSX keeps only its component name and attribute list; the named values are read from the list again. */
const rawJsxAttrs = (attrs, name) => ({
    name,
    attributes: Array.isArray(attrs?.attributes) ? attrs.attributes : [],
});
const toStoredNode = (site, working) => {
    const content = working.content?.map((child) => toStoredNode(site, child));
    const marks = working.marks?.map(storedMark);
    if (working.type === "codeBlock") {
        return storedNode("codeBlock", storedCodeBlockAttrs(site, working.attrs ?? {}), content, marks, working.text, working.id);
    }
    if (working.type !== "mdxJsx" && jsxRegistryOf(site).BLOCK_JSX_NAMES.has(working.type)) {
        const block = definitionOf(site, working);
        if (block)
            return storedNode(block.name, valuesOf(working.attrs), content, marks, working.text, working.id);
        // No plain definition (spread attributes, `Math`, a table row outside a table): keep it as raw JSX.
        return storedNode("mdxJsx", rawJsxAttrs(working.attrs, working.type), content, marks, working.text, working.id);
    }
    if (working.type === "mdxJsx") {
        const name = typeof working.attrs?.name === "string" ? working.attrs.name : "";
        return storedNode("mdxJsx", rawJsxAttrs(working.attrs, name), content, marks, working.text, working.id);
    }
    return storedNode(working.type, working.attrs, content, marks, working.text, working.id);
};
const isBlankParagraph = (block) => block.type === "paragraph" && (block.content ?? []).length === 0;
/** The stored form of a working document, or `null` when the body cannot be stored as a document (it has front matter). */
export const toStoredDocument = (site, working) => {
    if (working.type !== "doc")
        throw new TypeError("Not a document");
    if (working.attrs?.frontmatter !== undefined)
        return null;
    const content = (working.content ?? []).map((node) => toStoredNode(site, node));
    while (content.length > 0 && isBlankParagraph(content[content.length - 1]))
        content.pop();
    return { content, type: "doc", version: STORED_DOCUMENT_VERSION };
};
/** Working JSX node for a stored block: the component name and a raw attribute list rebuilt from the values. */
const jsxNode = (component, values) => ({
    ...values,
    name: component,
    attributes: Object.entries(values).map(([name, value]) => ({ name, value })),
});
const toWorkingNode = (site, stored) => {
    const out = { type: stored.type };
    const content = stored.content?.map((child) => toWorkingNode(site, child));
    let attrs = stored.attrs ? { ...stored.attrs } : undefined;
    if (stored.type === "codeBlock") {
        attrs = workingCodeBlockAttrs(site, attrs ?? {});
    }
    else if (stored.type === "mdxJsx") {
        const name = typeof attrs?.name === "string" ? attrs.name : "";
        const attributes = Array.isArray(attrs?.attributes) ? attrs.attributes : [];
        // The same shape `toDocument` gives JSX: the named values, then the component name and the raw list.
        attrs = { ...attributeRecord(attributes), name, attributes };
        if (name && jsxRegistryOf(site).BLOCK_JSX_NAMES.has(name))
            out.type = name;
    }
    else if (!CORE_NODE_TYPES.has(stored.type)) {
        const block = site.BLOCK_BY_NAME.get(stored.type);
        if (block) {
            out.type = block.component;
            attrs = jsxNode(block.component, attrs ?? {});
        }
    }
    if (attrs)
        out.attrs = attrs;
    if (content)
        out.content = content;
    if (stored.marks)
        out.marks = stored.marks.map((mark) => ({ ...mark }));
    if (stored.text !== undefined)
        out.text = stored.text;
    if (stored.id !== undefined)
        out.id = stored.id;
    return out;
};
/** The working document (the shape `toDocument` makes and `serialize` reads) of a stored document. */
export const fromStoredDocument = (site, stored) => ({
    type: "doc",
    content: stored.content.map((node) => toWorkingNode(site, node)),
});
/** Two documents with the same content (block ids are not content). */
const sameDocument = (left, right) => JSON.stringify(withoutBlockIds(left.content)) === JSON.stringify(withoutBlockIds(right.content));
const withContent = (doc, content) => ({
    content,
    type: "doc",
    version: doc.version,
});
const storedFrom = (site, analysis) => {
    if (analysis.errors.length > 0)
        return null;
    try {
        return toStoredDocument(site, toDocument(site, analysis));
    }
    catch {
        return null;
    }
};
const outOfRangeIn = (site, node) => [
    ...(node.type === "codeBlock" ? outOfRangeAnnotationNames(site, node.attrs ?? {}) : []),
    ...(node.content ?? []).flatMap((child) => outOfRangeIn(site, child)),
];
/** Annotations of the code blocks of a parsed body that the stored document cannot keep as written. */
const outOfRangeOf = (site, analysis, doc) => {
    const working = toDocument(site, analysis);
    return (working.content ?? []).flatMap((block, index) => {
        const blockId = doc.content[index]?.id;
        return outOfRangeIn(site, block).map((name) => ({ name, ...(blockId === undefined ? {} : { blockId }) }));
    });
};
/**
 * A body from MDX. When the MDX parses, the document is the source and the MDX is written from it with `syntax`, so the same content is always
 * written as the same text. The written text must read back to the same document; if it does not (or the MDX does not parse, or has front matter),
 * the MDX is kept exactly as given and there is no document. MDX carries no block ids, so the document's blocks inherit them from `options.previous` or get new ones.
 */
export const bodyFromMdx = (site, mdx, syntax = [], options = {}) => {
    const analysis = analyze(site, mdx, undefined, syntax);
    const parsed = storedFrom(site, analysis);
    if (!parsed)
        return { mdx, doc: null, analysis };
    const doc = withContent(parsed, assignBlockIds(parsed.content, [options.previous?.content]));
    const outOfRange = outOfRangeOf(site, analysis, doc);
    const written = serialize(site, fromStoredDocument(site, doc), syntax);
    if (written === mdx)
        return { mdx, doc, analysis, outOfRange };
    const rewritten = analyze(site, written, undefined, syntax);
    const reread = storedFrom(site, rewritten);
    if (!reread || !sameDocument(doc, reread))
        return { mdx, doc: null, analysis };
    return { mdx: written, doc, analysis: rewritten, outOfRange };
};
/** The document of a body read from MDX: its parsed document, or an `unparsed` node holding the text when it has none. */
export const bodyDocument = (body, previous) => body.doc ?? unparsedDocument(body.mdx, previous);
/**
 * The MDX a document is written as: `syntax` over the document, and for a body that could not be read (a single `unparsed` node), the text it was
 * given, exactly.
 */
export const documentToMdx = (site, doc, syntax = []) => {
    const only = doc.content.length === 1 ? doc.content[0] : undefined;
    if (only?.type === UNPARSED_NODE && typeof only.attrs?.source === "string")
        return only.attrs.source;
    return serialize(site, fromStoredDocument(site, doc), syntax);
};
/**
 * A body from a stored document, through the MDX it is written as: written with `syntax` and read back, so the result is the same as from that MDX.
 * The block ids of `doc` are kept (a block without one, or with a copy of another's, gets one as `bodyFromMdx` would). Used where the MDX text has to be
 * derived from a document (the legacy store migrations).
 */
export const bodyFromDocument = (site, doc, syntax = [], options = {}) => {
    const body = bodyFromMdx(site, serialize(site, fromStoredDocument(site, doc), syntax), syntax);
    if (!body.doc)
        return body;
    // Read back as the same document: its blocks are the given ones, in the same order. Otherwise pair them up.
    const same = sameDocument(doc, body.doc);
    const given = same ? copyBlockIds(body.doc.content, doc.content) : withoutBlockIds(body.doc.content);
    const content = assignBlockIds(given, same ? [options.previous?.content] : [doc.content, options.previous?.content]);
    return { ...body, doc: withContent(body.doc, content) };
};
