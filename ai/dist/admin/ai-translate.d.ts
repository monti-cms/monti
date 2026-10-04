import type { EditorExtension } from "@monti-cms/admin";
import type { BlockAction } from "@monti-cms/admin/editor";
import type { Editor } from "@tiptap/react";
/**
 * AI translation behavior in the translation editor. `blockActions` are the translation actions next to the block handle (one per action, named by the action name),
 * and `toolbar` is Translate all in the toolbar. If there is no usable translation action, both are absent.
 */
export declare function useAiTranslate(locales: {
    sourceLocale: string;
    targetLocale: string;
} | null): {
    blockActions: BlockAction[];
    toolbar: import("react").JSX.Element | null;
    setEditor: (editor: Editor | null) => void;
};
/** AI translation attached as an edit-screen extension. Adds Translate all to the translation editor's toolbar and translation actions next to block handles. */
export declare const useAiTranslateExtension: EditorExtension;
