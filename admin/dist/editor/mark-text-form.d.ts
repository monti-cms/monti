import type { Editor } from "@tiptap/core";
import { type ReactNode } from "react";
/**
 * Input form and popover to add, edit and remove a text decoration that carries one text property (body tooltip `content`, in-code tooltip, etc.).
 * Takes the decoration name and wording and renders them. Shared by the core code block's text tooltip and the blocks extension's body tooltip.
 */
/** Form wording. */
export interface MarkTextLabels {
    /** Decoration name (e.g. `Tooltip`). Used for the button name, the title ("Add Tooltip"/"Edit Tooltip") and the remove button ("Remove Tooltip"). */
    readonly name: string;
    /** Input field name (e.g. `Description`). */
    readonly field: string;
    /** Message when submitting empty (e.g. `Enter a description.`). */
    readonly empty: string;
}
export interface MarkTextFormProps {
    editor: Editor;
    /** Editor mark name. */
    mark: string;
    /** Name of the mark attribute that holds the text. */
    attribute: string;
    labels: MarkTextLabels;
    /** True if the cursor or selection is already inside this decoration. The text can be edited and removed. */
    active: boolean;
    initial: string;
    /** Range of the decoration to edit. If given, this range is edited instead of the current selection (when the cursor is at a decoration boundary in the inline bubble). */
    range?: {
        from: number;
        to: number;
    };
    onDone: () => void;
}
/** Decoration text input form. Shared by the formatting tool popover and the inline bubble. */
export declare function MarkTextForm({ editor, mark, attribute, labels, active, initial, range, onDone }: MarkTextFormProps): import("react").JSX.Element;
export interface MarkTextPopoverProps {
    editor: Editor;
    mark: string;
    attribute: string;
    labels: MarkTextLabels;
    icon: ReactNode;
    /** Opens when a window event with this name (`window.dispatchEvent(new CustomEvent(name))`) is received (slash menu, etc.). */
    openEvent?: string;
}
/**
 * Decoration text popover of the formatting tool. Disabled when the selection is empty and not inside a decoration. When the cursor is inside a decoration it is pressed, and the text can be edited or removed.
 * Enter is ignored during Korean IME composition.
 */
export declare function MarkTextPopover({ editor, mark, attribute, labels, icon, openEvent }: MarkTextPopoverProps): import("react").JSX.Element;
