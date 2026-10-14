/**
 * The footer of a dialog that holds a form: Cancel and a submit button. The submit button shows `busyLabel` (default "Saving…") while the
 * request runs. Put it inside the `<form>`; the dialog closes through `onCancel`.
 */
export declare function DialogFormFooter({ onCancel, submitLabel, busyLabel, busy, disabled, cancelLabel, }: {
    onCancel: () => void;
    submitLabel?: string;
    busyLabel?: string;
    busy?: boolean;
    disabled?: boolean;
    cancelLabel?: string;
}): import("react").JSX.Element;
