import { perSite } from "@monti-cms/core/client";
import { Mark, mergeAttributes } from "@tiptap/core";
const pascal = (name) => name.replace(/(^|-)([a-z0-9])/g, (_, _dash, char) => char.toUpperCase());
const kebab = (name) => name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
/** Editor mark name of an added text style (`cms` + Pascal-case block name). */
export const addedMarkName = (blockName) => `cms${pascal(blockName)}`;
/** HTML attribute name for one attribute. */
const dataAttribute = (name) => `data-mark-${kebab(name)}`;
/** Added text styles of a site (block name → definition). */
export const addedMarksOf = perSite((site) => new Map(site.ADDED_MARK_BLOCKS.map((block) => [block.name, block])));
/** Editor mark name → added text style definition. */
export const addedMarkByEditorName = perSite((site) => new Map(site.ADDED_MARK_BLOCKS.map((block) => [addedMarkName(block.name), block])));
/**
 * Style attributes keeping only the definition's attributes. Strings are kept when they have a value, required attributes (`required`) are kept even when empty (`""`). Booleans only when true.
 * Used in both directions, stored document (CmsNode) ↔ editor mark (serialization uses the same rule, so a round trip keeps the text the same).
 */
export function markAttrsOf(block, attrs) {
    const out = {};
    for (const [name, attribute] of Object.entries(block.attributes)) {
        const value = attrs?.[name];
        if (attribute.type === "boolean") {
            if (value === true || value === "true")
                out[name] = true;
            continue;
        }
        if (typeof value === "string" && value !== "")
            out[name] = value;
        else if (attribute.required)
            out[name] = typeof value === "number" ? String(value) : "";
    }
    return out;
}
/** Attribute pointing to a line label (`codeAnchor`). */
const anchorAttribute = (block) => Object.entries(block.attributes).find(([, attribute]) => attribute.codeAnchor)?.[0];
/** Tiptap mark for one added text style. */
export function createAddedMark(block, spec = {}) {
    const attributes = Object.entries(block.attributes);
    const anchor = anchorAttribute(block);
    return Mark.create({
        name: addedMarkName(block.name),
        inclusive: spec.inclusive ?? false,
        addAttributes() {
            return Object.fromEntries(attributes.map(([name, attribute]) => [
                name,
                {
                    default: null,
                    parseHTML: (element) => {
                        const value = element.getAttribute(dataAttribute(name));
                        return attribute.type === "boolean" ? value !== null || null : value;
                    },
                    // Not drawn per attribute; all are drawn at once in `renderHTML` below.
                    renderHTML: () => ({}),
                },
            ]));
        },
        parseHTML() {
            return [{ tag: `span[data-cms-mark="${block.name}"]` }];
        },
        renderHTML({ mark, HTMLAttributes }) {
            const attrs = mark.attrs;
            const data = Object.fromEntries(Object.entries(markAttrsOf(block, attrs)).map(([name, value]) => [
                dataAttribute(name),
                value === true ? "" : String(value),
            ]));
            const anchorValue = anchor ? attrs[anchor] : undefined;
            return [
                "span",
                mergeAttributes(HTMLAttributes, { "data-cms-mark": block.name, ...data }, 
                // When pointing at a code line label, the editor code block highlights the line the mouse is over (`data-code-ref`).
                typeof anchorValue === "string" && anchorValue ? { "data-code-ref": anchorValue } : {}, spec.render?.(attrs) ?? {}),
                0,
            ];
        },
    });
}
/** A style linking body text and a code line (blocks with `codeAnchor` in their attributes). If none, the code block's link tool is hidden. */
export const codeAnchorRef = perSite((site) => {
    for (const block of site.ADDED_MARK_BLOCKS) {
        const attribute = anchorAttribute(block);
        if (attribute)
            return { mark: addedMarkName(block.name), attribute };
    }
    return null;
});
