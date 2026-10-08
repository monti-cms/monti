import { type ComponentProps, type ReactNode } from "react";
import { IconButton } from "../../ui/icon-button.js";
export { BLOCK_TOOLBAR, SELECTED_RING, useEditorEditable } from "./block-model.js";
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
export declare function BlockSettings({ label: labelProp, open, onOpenChange, children, }: {
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
