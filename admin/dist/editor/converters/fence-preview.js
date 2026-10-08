import { codeFenceOf, storedCodeAttrs } from "./code-block.js";
import { asString } from "./shared.js";
/**
 * Converter for an added code fence block (e.g. ` ```mermaid `). Turns a code block of that language into a block node and restores the language and meta
 * as they were on save. On a site without the block installed, it stays a plain code block.
 */
export function fenceBlockConverter(block, nodeName) {
    const lang = block.syntax.kind === "fence" ? block.syntax.lang : block.name;
    return {
        name: block.name,
        cmsTypes: ["codeBlock"],
        tiptapTypes: [nodeName],
        matches: (node) => asString(node.attrs?.language)?.toLowerCase() === lang,
        isMappable: () => true,
        toTiptap(node, { site }) {
            const language = asString(node.attrs?.language) ?? lang;
            const meta = asString(node.attrs?.meta) ?? "";
            return { type: nodeName, attrs: { value: codeFenceOf(site, node), language, ...(meta ? { meta } : {}) } };
        },
        toCms(node, { site }) {
            const value = asString(node.attrs?.value) ?? "";
            const language = asString(node.attrs?.language) || lang;
            const meta = asString(node.attrs?.meta) ?? null;
            return [{ type: "codeBlock", attrs: storedCodeAttrs(site, language, meta, value) }];
        },
    };
}
export const mathConverter = {
    name: "math",
    cmsTypes: ["math"],
    tiptapTypes: ["cmsMath"],
    isMappable: () => true,
    toTiptap(node) {
        const value = asString(node.attrs?.value) ?? "";
        return {
            type: "cmsMath",
            attrs: {
                value,
            },
        };
    },
    toCms(node) {
        const value = asString(node.attrs?.value) ?? "";
        return [
            {
                type: "math",
                attrs: {
                    value,
                },
            },
        ];
    },
};
