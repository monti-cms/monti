/**
 * Editor body width. Changes only the width shown while editing; unrelated to the saved content and the public page.
 * The browser remembers only the step name, so the width values can be changed here alone.
 */
export declare const EDITOR_WIDTHS: {
    /** Comfortable reading width for body text (42rem, same as Tailwind `max-w-2xl`). */
    readonly narrow: "42rem";
    readonly normal: "48rem";
    readonly wide: "64rem";
    readonly full: "none";
};
export type EditorWidth = keyof typeof EDITOR_WIDTHS;
/** Chosen body width. Remembered in this browser, per site; starts at the normal width if storage is unavailable. */
export declare function useEditorWidth(): [EditorWidth, (width: EditorWidth) => void];
/** Body width menu at the right end of the toolbar. */
export declare function EditorWidthMenu({ value, onChange }: {
    value: EditorWidth;
    onChange: (width: EditorWidth) => void;
}): import("react").JSX.Element;
