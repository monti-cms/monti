import { type NodeViewProps } from "@tiptap/react";
/**
 * Code block editing view.
 * - Top: language, file name, regex rules, line numbers (shown on the public page), copy
 * - Left line number gutter: pressing or dragging to pick lines opens the line effect menu. The fold arrows open and close folds even while editing.
 * - Code: edited in place. Text effects are applied by selecting text and using the inline bubble or the top toolbar.
 */
export declare function CodeBlockView({ node, updateAttributes, editor, getPos }: NodeViewProps): import("react").JSX.Element;
