import type { Editor, JSONContent } from "@tiptap/core";
import { type Node as PmNode } from "@tiptap/pm/model";
export interface TranslateUnit {
    /** Source MDX to send (with the notice markers stripped). */
    mdx: string;
    /** JSON of the block to replace. Used to see whether the user edited it in the meantime. */
    original: string;
    /** For a list item, the kind of the wrapping list. */
    wrap: string | null;
}
export type ApplyResult = "replaced" | "changed" | "invalid";
/** Whether a translation notice remains in the block. */
export declare function hasHints(node: PmNode): boolean;
/** Source MDX of a block (JSON). */
export declare const sourceMdxFromJson: (json: JSONContent) => string;
/** Translation unit of one block. `parent` is the node that contains the block. */
export declare function unitOf(node: PmNode, parent: PmNode | null): TranslateUnit;
/** Translation unit at a block handle position (`pos` is right before the block). `null` if there is no notice. */
export declare function unitAt(doc: PmNode, pos: number): TranslateUnit | null;
/** Units of Translate all. One per top-level block, and one per item for lists. */
export declare function collectUnits(doc: PmNode): TranslateUnit[];
/**
 * Replaces the original block with the translation result. If the block changed in the meantime, `changed`; if the result does not fit that position,
 * `invalid`; in both cases the document is untouched.
 */
export declare function applyTranslation(editor: Editor, unit: TranslateUnit, mdx: string, hint: number | null): ApplyResult;
