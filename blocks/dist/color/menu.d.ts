import type { Editor } from "@tiptap/core";
import { type ColorPair } from "./colors.js";
/** Editor mark name (`cmsColor`). */
export declare const COLOR_MARK_NAME: string;
type ColorKind = "fg" | "bg";
/** Changes only the text color or only the background color of the selected text. If both end up removed, the mark is removed. */
export declare function applyTextColor(editor: Editor, kind: ColorKind, color: ColorPair | null): void;
/** Text/background color picker list. Shared by the toolbar menu and the "More" menu. */
export declare function TextColorMenuItems({ editor }: {
    editor: Editor;
}): import("react").JSX.Element;
/** Text/background color picker that expands inside the format bubble. Calls `onPicked` when a color is chosen. */
export declare function TextColorPanel({ editor, onPicked }: {
    editor: Editor;
    onPicked?: () => void;
}): import("react").JSX.Element;
/** Text color button icon. Painted with the text and background colors of the current selection (shared by the toolbar and the format bubble). */
export declare function TextColorIcon({ editor }: {
    editor: Editor;
}): import("react").JSX.Element;
/** Text color button in the toolbar. The icon shows the current text color. */
export declare function TextColorMenu({ editor }: {
    editor: Editor;
}): import("react").JSX.Element;
export {};
