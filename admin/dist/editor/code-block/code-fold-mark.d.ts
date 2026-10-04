import { Mark } from "@tiptap/core";
/**
 * Folding text inside code (`// @char fold {…}`). On the public page it is folded as `…` and unfolds when clicked.
 * The editor also shows it folded (effects-plugin), and unfolds when the cursor enters or `…` is clicked.
 * `inclusive` is turned off so text typed after it does not get folded.
 */
export declare const CodeFoldMark: Mark<any, any>;
