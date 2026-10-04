import { Mark } from "@tiptap/core";
export declare const UNTRANSLATED_MARK_NAME = "untranslated";
/**
 * Translation notice text. A new translation wraps the source text in this mark. It shows dimmed, and when typing starts in that text block
 * (characters, paste, Korean composition, deletion), all notice text is removed at once before the input. `inclusive` is turned off
 * so that characters typed after the notice text do not become notice text.
 */
export declare const CmsUntranslatedMark: Mark<any, any>;
