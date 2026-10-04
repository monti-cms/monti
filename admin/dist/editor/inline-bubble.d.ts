import { type Editor } from "@tiptap/core";
import { type ReactNode } from "react";
import { type EditorMarkExtension, type EditorSelectionAction } from "../admin-components.js";
/**
 * Registered text-style extensions and their editor mark names. Given an `editor`, returns only the styles in that editor's schema (registrations
 * of blocks the site does not use are ignored).
 */
export declare function useMarkExtensions(editor?: Editor | null): {
    name: string;
    extension: EditorMarkExtension;
}[];
/** A bubble button. The name (aria-label) and tooltip are the same. With `pressed`, it is a toggle button. Extension bubble buttons use this too. */
export declare function BubbleButton({ label, onClick, pressed, destructive, className, children, }: {
    label: string;
    onClick: () => void;
    pressed?: boolean;
    destructive?: boolean;
    className?: string;
    children: ReactNode;
}): import("react").JSX.Element;
/**
 * Inline effect bubble that floats above body text.
 * - When text is selected by dragging: tools to apply effects like bold and italic, and tooltip and link, right away.
 * - When the cursor is inside an effect: the spanning effects and a remove button, the link URL / tooltip text and an edit button.
 * Link and tooltip editing expands into an input form inside the bubble (no need to go to the top formatting tools).
 * For an extension's text styles (`CmsAdminComponents.marks`), it renders the buttons and content that extension provides.
 */
export declare function InlineBubble({ editor, actions, }: {
    editor: Editor;
    /** Actions to add at the end of the selection menu (plugins, e.g. polishing writing style). */
    actions?: readonly EditorSelectionAction[];
}): import("react").ReactPortal | null;
