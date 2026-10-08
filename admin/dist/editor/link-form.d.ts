import type { ChainedCommands, Editor } from "@tiptap/core";
import { type KeyboardEvent, type ReactNode } from "react";
export declare function normalizeLinkHref(value: string): string | null;
/** Range where a link is inserted or edited. Captures the selection at the moment the form opens (kept even when focus moves to the input). */
export interface LinkDraft {
    from: number;
    to: number;
    existing: boolean;
    /** The address typed in the form. An internal link has none: it points to an entry. */
    href: string;
    /** The id of the entry an existing internal link points to. */
    entryId?: string | null;
}
export declare function linkDraftFromSelection(editor: Editor): LinkDraft;
/** Collapses the cursor to the end of the effect after applying it. With the cursor at the end of the effect, the inline bubble shows the applied result. */
export declare const collapseToEnd: (chain: ChainedCommands) => ChainedCommands;
/** Whether this Enter finishes Korean composition. The form is not submitted then. */
export declare const isComposingKey: (event: KeyboardEvent) => boolean;
/**
 * Enter handling for popover input forms (link, tooltip). Enter during Korean composition is ignored, and Enter submits even in multi-line fields (Shift+Enter inserts a line break).
 * Attach it as `<form onKeyDown={submitOnEnter}>`.
 */
export declare function submitOnEnter(event: KeyboardEvent<HTMLFormElement>): void;
/** Button row below a popover input form: remove on the left, cancel and apply on the right. Shared by the link and tooltip forms. */
export declare function PopoverFormFooter({ removeLabel, removeIcon, onRemove, onCancel, }: {
    removeLabel: string;
    removeIcon: ReactNode;
    /** Passed only when editing an effect that is already applied. */
    onRemove?: () => void;
    onCancel: () => void;
}): import("react").JSX.Element;
/** One-line red error of a popover input form. */
export declare function PopoverFormError({ id, children }: {
    id: string;
    children: ReactNode;
}): import("react").JSX.Element;
interface LinkFormProps {
    editor: Editor;
    draft: LinkDraft;
    onDone: () => void;
}
/** Link address input form. Shared by the top formatting toolbar's popover and the inline bubble. */
export declare function LinkForm({ editor, draft, onDone }: LinkFormProps): import("react").JSX.Element;
export {};
