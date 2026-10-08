import { type Editor, Extension } from "@tiptap/core";
import { type Node as PmNode } from "@tiptap/pm/model";
import type { TranslatorFor } from "../translator.js";
import type { editorMessages } from "./messages.js";
/**
 * Block operations: move up/down, duplicate, delete. The block handle menu and keyboard shortcuts use the same commands.
 * Supports paragraphs, custom blocks (raw-source box, image, table), and nested blocks (list items, inside blockquotes).
 */
interface TopLevelBlock {
    index: number;
    start: number;
    end: number;
    node: PmNode;
}
/** Top-level block containing the document position (kept for backward compatibility). */
export declare function topLevelBlockAt(doc: PmNode, pos: number): TopLevelBlock | null;
export declare function moveBlock(editor: Editor, pos: number, direction: -1 | 1): boolean;
export declare function duplicateBlock(editor: Editor, pos: number): boolean;
export declare function deleteBlock(editor: Editor, pos: number): boolean;
/** Shortcuts to operate blocks without a mouse. */
export declare const CmsBlockKeymap: Extension<any, any>;
export declare const blockShortcuts: (t: TranslatorFor<typeof editorMessages>) => readonly [{
    readonly keys: "Alt+↑ / Alt+↓";
    readonly label: string;
}, {
    readonly keys: "Mod+Shift+D";
    readonly label: string;
}, {
    readonly keys: "Mod+Shift+Backspace";
    readonly label: string;
}];
export {};
