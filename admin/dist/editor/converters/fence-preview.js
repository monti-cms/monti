import { annotationConfig, fromCodeBlockDocumentToCodeFence } from "@monti-cms/core/code-block";
import { asString } from "./shared.js";
const extractCodeValue = (node) => {
    const value = asString(node.attrs?.value);
    if (value != null)
        return value;
    const document = node.attrs?.codeDocument;
    if (document && typeof document === "object" && !Array.isArray(document)) {
        return fromCodeBlockDocumentToCodeFence(document, annotationConfig).value;
    }
    return "";
};
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
        toTiptap(node) {
            const language = asString(node.attrs?.language) ?? lang;
            const meta = asString(node.attrs?.meta) ?? "";
            return { type: nodeName, attrs: { value: extractCodeValue(node), language, ...(meta ? { meta } : {}) } };
        },
        toCms(node) {
            const value = asString(node.attrs?.value) ?? "";
            const language = asString(node.attrs?.language) || lang;
            const meta = asString(node.attrs?.meta);
            return [{ type: "codeBlock", attrs: { language, ...(meta ? { meta } : {}), value } }];
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
