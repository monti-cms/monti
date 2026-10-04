import type { Editor } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { type NodeViewProps } from "@tiptap/react";
import { type ComponentProps, type ReactNode } from "react";
import { IconButton } from "../../ui/icon-button.js";
/** Selected block border. All blocks use the same look. */
export declare const SELECTED_RING = "ring-2 ring-cms-ring ring-offset-2 ring-offset-cms-background";
/** Look of the control toolbar floating over a block (shared by the block toolbar, images, and tables). */
export declare const BLOCK_TOOLBAR = "z-10 flex items-center gap-0.5 rounded-md border bg-cms-popover/95 p-0.5 text-cms-popover-foreground shadow-sm backdrop-blur";
export type ContainerValues = Record<string, string | boolean>;
export declare const valuesOf: (node: PmNode) => ContainerValues;
/** Emptied values (empty string, false) are removed from attributes. Keeping them would save a `title=""` that was not in the source. */
export declare const withValue: (values: ContainerValues, key: string, value: string | boolean) => ContainerValues;
export declare const useContainerValues: ({ node, updateAttributes }: Pick<NodeViewProps, "node" | "updateAttributes">) => readonly [ContainerValues, (key: string, value: string | boolean) => void];
/**
 * Whether the editor can be edited. Re-renders when the lock (trash, raw mode) changes.
 * A node view that reads `editor.isEditable` once while rendering does not follow lock changes, so use this.
 */
export declare function useEditorEditable(editor: Editor | null | undefined): boolean;
/** Start position of the i-th child inside the parent container. */
export declare const childPos: (parent: PmNode, parentPos: number, index: number) => number;
/**
 * Which child of this container the current selection is in. -1 if outside.
 * -1 when the editor has no focus, so that the cursor at the very start of the document when first opening a post (the first tab if the first block is tabs)
 * does not overwrite the initial open tab or collapsed state.
 */
export declare const useSelectedChildIndex: (editor: Editor, getPos: NodeViewProps["getPos"]) => number;
/** Moves the cursor into the container (a child index or the start of the body). */
export declare const focusInside: (editor: Editor, getPos: NodeViewProps["getPos"], index?: number) => void;
/** Selects the whole container (when no cursor should be left inside the body to hide). */
export declare const selectContainer: (editor: Editor, getPos: NodeViewProps["getPos"]) => void;
/**
 * Input field for attributes (title, tab name). During Korean composition it does not write to the document, and writes when composition ends.
 * Enter returns to the body and Escape returns to the editor.
 */
export declare function AttributeInput({ value, onCommit, onEnter, onEscape, required, onBlur, className, ...props }: Omit<ComponentProps<"input">, "value" | "onChange" | "defaultValue"> & {
    value: string;
    onCommit: (value: string) => void;
    onEnter?: () => void;
    onEscape?: () => void;
    /** Do not write an emptied value (tab name). Leaving it empty restores the original value. */
    required?: boolean;
}): import("react").JSX.Element;
/** Control toolbar shown only when the mouse is over the container or the cursor is inside. */
export declare function ContainerToolbar({ visible, className, children, label, }: {
    visible?: boolean;
    className?: string;
    children: ReactNode;
    label: string;
}): import("react").JSX.Element;
/** Icon button of the toolbar. Its name shows on mouse hover. */
export declare function ToolbarButton(props: ComponentProps<typeof IconButton>): import("react").JSX.Element;
/**
 * Block settings button and its popover. All block attributes (width, alt text, initial state, etc.) go here.
 * Align the fields inside with `BlockSettingsField`.
 */
export declare function BlockSettings({ label, open, onOpenChange, children, }: {
    label?: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: ReactNode;
}): import("react").JSX.Element;
/** One field in the settings popover (name above, input below). */
export declare function BlockSettingsField({ label, htmlFor, action, children, }: {
    label: string;
    htmlFor?: string;
    /** Small button next to the name on the right (AI, etc.). */
    action?: ReactNode;
    children: ReactNode;
}): import("react").JSX.Element;
