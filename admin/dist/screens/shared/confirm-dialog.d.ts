import { type ReactNode } from "react";
export interface ConfirmRequest {
    title: string;
    description: ReactNode;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => void | Promise<void>;
}
/** Confirm dialog for hard-to-undo actions. On cancel, focus returns to the button that opened it. */
export declare function ConfirmDialog({ request, onClose }: {
    request: ConfirmRequest | null;
    onClose: () => void;
}): import("react").JSX.Element;
/** The question asked when discarding unsaved content. Every edit slot with a save button uses the same wording. */
export declare const DISCARD_CONFIRM: {
    readonly title: string;
    readonly description: string;
    readonly confirmLabel: string;
    readonly destructive: true;
};
/**
 * Opens the confirm dialog as a Promise. `confirm(...)` resolves to true or false depending on which button was pressed.
 * Render `dialog` once somewhere on the screen.
 */
export declare function useConfirm(): {
    confirm: (next: Omit<ConfirmRequest, "onConfirm">) => Promise<boolean>;
    confirmDiscard: (dirty: boolean) => Promise<boolean>;
    dialog: import("react").JSX.Element;
};
