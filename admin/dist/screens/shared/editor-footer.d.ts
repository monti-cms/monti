import type { ReactNode } from "react";
/**
 * The action row under an edit form: the error of the last attempt, Save (enabled while there are unsaved changes), Cancel (when `onCancel` is
 * given: a new item can be abandoned), anything extra, and Delete at the far end (when `onDelete` is given). Pair it with `useDraftEditor`.
 */
export declare function EditorFooter({ dirty, saving, deleting, canSave, error, onSave, onCancel, onDelete, saveLabel, saveIcon, align, children, className, }: {
    dirty: boolean;
    saving?: boolean;
    deleting?: boolean;
    /** The form is complete enough to save (a name is filled in). */
    canSave?: boolean;
    error?: string | null;
    /** Called on the Save button; with a `<form onSubmit>` around the footer, pass `submit` instead. */
    onSave?: () => void;
    onCancel?: () => void;
    onDelete?: () => void;
    saveLabel?: string;
    saveIcon?: ReactNode;
    align?: "start" | "end";
    /** Extra buttons between Cancel and Delete. */
    children?: ReactNode;
    className?: string;
}): import("react").JSX.Element;
