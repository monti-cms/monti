/** What the page shows as prose, for a summary (`fillFromBody`). */
export const EXCERPT_TEXT = { code: false, media: false, hidden: false };
/** Everything a person could look for in the body, for search. */
export const SEARCH_TEXT = { code: true, media: true, hidden: true };
/** Nodes that sit inside a line of text: neighbors of these run together, everything else is set apart by a space. */
const INLINE_TYPES = new Set(["text", "hardBreak", "footnoteReference", "mdxExpression"]);
const MEDIA_TYPES = new Set(["image", "file"]);
/** Values of the attributes a block definition marks `translatable` (a callout title, a tab label, an image alt…): text a reader sees. */
const translatableValues = (attributes, values) => Object.entries(attributes ?? {}).flatMap(([name, attribute]) => {
    const value = values?.[name];
    return attribute.translatable && typeof value === "string" ? [value] : [];
});
/**
 * For a body that could not become a document (an `unparsed` node): its text with comments, import/export lines, link addresses and tags removed.
 * It is a fallback, so it only has to be better than nothing for search and summaries; a body that is a document never goes through it.
 */
const looseText = (source) => source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/^\s*(?:export|import)\b[\s\S]*?;(?:\r?\n|$)/gm, " ")
    .replace(/!?\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/<[a-zA-Z0-9_/][^>"\x27]*(?:"[^"]*"|\x27[^\x27]*\x27|[^>"\x27]*)*>/g, " ");
const textOf = (site, node, options) => {
    if (node.type === "text") {
        const marks = node.marks ?? [];
        if (!options.code && marks.some((mark) => mark.type === "code"))
            return "";
        if (!options.hidden && marks.some((mark) => mark.type === "untranslated"))
            return "";
        const own = node.text ?? "";
        if (!options.hidden)
            return own;
        // The hover text of a text decoration is attached to its text.
        const hover = marks.flatMap((mark) => translatableValues(site.BLOCK_BY_NAME.get(mark.type)?.attributes, mark.attrs));
        return [own, ...hover].join(" ");
    }
    if (node.type === "hardBreak")
        return " ";
    if (node.type === "unparsed")
        return looseText(String(node.attrs?.source ?? ""));
    if (node.type === "codeBlock")
        return options.code ? String(node.attrs?.code ?? node.attrs?.value ?? "") : "";
    if (node.type === "math")
        return options.code ? String(node.attrs?.value ?? "") : "";
    if (!options.media && MEDIA_TYPES.has(node.type))
        return "";
    if (node.type === "footnoteReference" ||
        node.type === "mdxExpression" ||
        node.type === "html" ||
        node.type === "mdxEsm") {
        return "";
    }
    const own = translatableValues(site.BLOCK_BY_NAME.get(node.type)?.attributes, node.attrs);
    const parts = [];
    let previous;
    for (const child of node.content ?? []) {
        const text = textOf(site, child, options);
        if (previous && !(INLINE_TYPES.has(previous.type) && INLINE_TYPES.has(child.type)))
            parts.push(" ");
        parts.push(text);
        previous = child;
    }
    return [...own, parts.join("")].join(" ");
};
const collapse = (text) => text.replace(/\s+/g, " ").trim();
/**
 * The text of a document, as one line (runs of whitespace are one space). Block elements are set apart by a space and inline
 * runs stay together, so a word split by emphasis is still one word.
 */
export function documentText(site, doc, options) {
    return collapse(doc.content.map((node) => textOf(site, node, options)).join(" "));
}
