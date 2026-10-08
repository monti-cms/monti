import { UNPARSED_NODE } from "../../doc/stored-document.js";
import { perSite } from "../../site/per-site.js";
import { translationMessages } from "./messages.js";
/**
 * Structure check of translation results. Checks that the source and the translation have the same "skeleton without text".
 *
 * - Must be the same: kinds and order of block and inline elements, link addresses, image addresses, code/math contents, code languages,
 *   block names and attributes humans do not read, inline code text.
 * - May differ: text, values of human-readable attributes, where bold/links fall inside a sentence.
 *
 * Human-readable attributes are decided by the block definition: translatable attributes (`translatable`) and attributes that point to such an attribute's value
 * (`childValue`, e.g. initially open tab → tab name). Blocks added by the site follow the same rules.
 */
/** Human-readable attributes of elements without a block definition (link title `[text](address "title")`). */
const MARKDOWN_READABLE = { link: ["title"] };
/** Human-readable attribute names of one block. */
export function readableAttributes(block, blockByName) {
    const childTranslatable = new Set((block.children?.blocks ?? []).flatMap((name) => Object.entries(blockByName.get(name)?.attributes ?? {}).flatMap(([attribute, definition]) => definition.translatable ? [attribute] : [])));
    return new Set(Object.entries(block.attributes).flatMap(([name, attribute]) => attribute.translatable || (attribute.childValue !== undefined && childTranslatable.has(attribute.childValue))
        ? [name]
        : []));
}
/**
 * Node/mark kind → human-readable attributes. The kind is the block name as stored (`callout`, `tooltip`, `image`) or `link` for a link mark.
 */
export function readableAttributesByType(blocks) {
    const byName = new Map(blocks.map((block) => [block.name, block]));
    const map = new Map();
    for (const block of blocks) {
        const readable = readableAttributes(block, byName);
        if (readable.size === 0)
            continue;
        map.set(block.name, readable);
    }
    for (const [type, names] of Object.entries(MARKDOWN_READABLE))
        map.set(type, new Set(names));
    return map;
}
const readableTypesOf = perSite((site) => readableAttributesByType(site.BLOCKS));
const NONE = new Set();
const readableOf = (site, type) => readableTypesOf(site).get(type) ?? NONE;
const withoutReadable = (site, type, attrs) => {
    const readable = readableOf(site, type);
    const kept = {};
    for (const [key, value] of Object.entries(attrs ?? {})) {
        if (!readable.has(key))
            kept[key] = value;
    }
    return kept;
};
function skeletonOf(site, node) {
    const marks = new Set();
    const codes = [];
    const children = [];
    for (const child of node.content ?? []) {
        if (child.type !== "text") {
            children.push(skeletonOf(site, child));
            continue;
        }
        for (const mark of child.marks ?? []) {
            if (mark.type === "code")
                codes.push(child.text ?? "");
            else
                marks.add(JSON.stringify([mark.type, withoutReadable(site, mark.type, mark.attrs)]));
        }
    }
    return {
        type: node.type,
        attrs: withoutReadable(site, node.type, node.attrs),
        marks: [...marks].sort(),
        codes: codes.sort(),
        children,
    };
}
/** The failure of a translated body that is not a document (`message`: why it could not be read, in the site's display language). */
export const unreadableFailure = (site, message) => {
    const tTranslation = site.createTranslator(translationMessages);
    return {
        ok: false,
        code: "mdx_error",
        reason: tTranslation("mdx_error", { message: message ?? tTranslation("unreadable") }),
    };
};
const isUnparsed = (doc) => doc.content.some((node) => node.type === UNPARSED_NODE);
/** Whether the translated document has the same skeleton as the source document. Failure if either is not a document (an `unparsed` body). */
export function compareStructure(site, source, translated) {
    const tTranslation = site.createTranslator(translationMessages);
    if (isUnparsed(translated))
        return unreadableFailure(site, undefined);
    if (isUnparsed(source))
        return { ok: false, code: "source_unreadable", reason: tTranslation("source_unreadable") };
    const a = skeletonOf(site, { type: "doc", content: [...source.content] });
    const b = skeletonOf(site, { type: "doc", content: [...translated.content] });
    return JSON.stringify(a) === JSON.stringify(b)
        ? { ok: true }
        : { ok: false, code: "structure_changed", reason: tTranslation("structure_changed") };
}
