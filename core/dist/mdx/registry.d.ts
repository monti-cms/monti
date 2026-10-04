export declare const REGISTERED_JSX_NAMES: Set<string>;
export declare const BLOCK_JSX_NAMES: Set<string>;
/** Text decoration renderer name → document mark name. For added text decorations (block extensions), the block name is the mark name. */
export declare const INLINE_JSX_MARKS: Record<string, string>;
/**
 * Mark sort order. The parser (`to-document`), serialization (`serialize`) and editor conversion (`tiptap-content`) must use the same order so that
 * round-trip document comparison does not break because of ordering. Added text decorations come after the translation note (outermost), in the order they were added.
 */
export declare const MARK_ORDER: string[];
export declare const sortMarks: <T extends {
    type: string;
}>(marks: readonly T[]) => T[];
/** Names removed in batch 4. If one remains in the body, `analyze` rejects it (read compatibility is also over). */
export declare const RETIRED_JSX_NAMES: Set<string>;
/** Event handler attribute names. React does not preserve case, so `onerror` is blocked as well. */
export declare const EVENT_HANDLER_NAME: RegExp;
