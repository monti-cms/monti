import { type EditorWidthStep as EditorWidthStepConfig } from "@monti-cms/core/client";
import type { TranslatorFor } from "../translator.js";
import { editorMessages } from "./messages.js";
/** One width step of the editor: `key` is what the browser remembers, `width` the CSS value of the body's `max-width`. */
export interface EditorWidthStep {
    readonly key: string;
    readonly label: string;
    readonly width: string;
}
/** The width of the single built-in step ("Normal") used when the config sets no `editor.widths`. */
export declare const DEFAULT_EDITOR_WIDTH = "48rem";
/** The `max-width` of the last step, "Full": no limit. */
export declare const FULL_EDITOR_WIDTH = "none";
/**
 * The steps of the width menu, in order: the config's `editor.widths` (or "Normal" when it sets none), then "Full". The first is where the editor starts.
 * Changes only the width shown while editing; unrelated to the saved content and the public page.
 */
export declare function resolveEditorWidths(configured: readonly EditorWidthStepConfig[] | undefined, t: TranslatorFor<typeof editorMessages>): EditorWidthStep[];
/**
 * The steps of this site and the chosen one. The choice is remembered in this browser, per site, by step key; a remembered key that no step has any more
 * (the config changed) and unavailable storage both leave the first step.
 */
export declare function useEditorWidth(): {
    steps: EditorWidthStep[];
    step: EditorWidthStep;
    choose: (key: string) => void;
};
/** Body width menu at the right end of the toolbar. */
export declare function EditorWidthMenu({ steps, value, onChange, }: {
    steps: readonly EditorWidthStep[];
    value: EditorWidthStep;
    onChange: (key: string) => void;
}): import("react").JSX.Element;
