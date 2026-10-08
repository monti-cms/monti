import { visit } from "unist-util-visit";
import { convertShikiNotation } from "./notation.js";
/**
 * Converts the Shiki notation in every code fence to Monti annotation comments (see `notation.ts`).
 *
 * It runs in the CMS parser and in the public render chain, before the code annotations are read, so a body written with Shiki notation
 * is stored with Monti annotations and renders the same without being saved first. Code without notation is not touched.
 */
export const remarkShikiNotation = (settings) => (tree) => {
    visit(tree, "code", (node) => {
        node.value = convertShikiNotation(node.value, node.lang, settings);
    });
};
