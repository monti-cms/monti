import { analyze, serialize, toDocument } from "../../mdx/index.js";
import { sortMarks } from "../../mdx/registry.js";
const HINT = { type: "untranslated" };
/** Attaches a translation hint marker to each text node. Code, math and diagrams are not text nodes (attribute values) and stay as is. */
const hint = (node) => {
    if (node.type === "text") {
        if (!node.text?.trim())
            return node;
        const marks = node.marks ?? [];
        return marks.some((mark) => mark.type === HINT.type) ? node : { ...node, marks: sortMarks([...marks, HINT]) };
    }
    return node.content ? { ...node, content: node.content.map(hint) } : node;
};
/**
 * Body of a new translation: keeps the source structure (headings, paragraphs, boxes, lists, tables) as is and wraps text
 * in translation hint markers (`:untranslated[source text]`). The editor shows the hint text dimmed and removes it on typing.
 * Things that are not text nodes, such as code, images, math and box titles, are copied from the source unchanged. If the source cannot be parsed, it is returned unchanged.
 */
export function withTranslationHints(sourceMdx) {
    const analysis = analyze(sourceMdx);
    if (analysis.errors.length > 0)
        return sourceMdx;
    return serialize(hint(toDocument(analysis)));
}
