import { type BlockDefinition } from "@monti-cms/core/client";
import type { CmsJsonValue } from "@monti-cms/core/mdx";
import { Mark } from "@tiptap/core";
/**
 * Editor display of added text styles (blocks from extensions or a site config's `syntax.kind: "text"` blocks). The core editor does not know style names and builds
 * Tiptap marks from block definitions. The look (classes, styles) and tools (formatting tools, bubble, slash menu) are provided by extensions through `CmsAdminComponentsProvider`'s
 * `marks` (block name → `EditorMarkExtension`).
 *
 * - A mark name is `cms` + the Pascal-case block name (`tooltip` → `cmsTooltip`, `code-ref` → `cmsCodeRef`).
 * - Attributes are the definition's attributes. In the stored document (CmsNode), the mark name is the block name and the attributes are the same.
 * - In HTML it is drawn as `span[data-cms-mark="block name"]` with `data-mark-<attribute>` for each attribute (paste reads this shape too).
 */
export type MarkAttrs = Readonly<Record<string, unknown>>;
/** Mark look that an extension changes. */
export interface EditorMarkSpec {
    /** Whether text typed right after the style also inherits it. If absent, it does not. */
    readonly inclusive?: boolean;
    /** HTML attributes to add to the `span` (`class`, `style`, `data-*`). Built from the attribute values (`attrs`). */
    readonly render?: (attrs: MarkAttrs) => Record<string, string>;
}
/** Editor mark name of an added text style (`cms` + Pascal-case block name). */
export declare const addedMarkName: (blockName: string) => string;
/** Added text styles (block name → definition). */
export declare const ADDED_MARKS: ReadonlyMap<string, BlockDefinition>;
/** Editor mark name → added text style definition. */
export declare const ADDED_MARK_BY_EDITOR_NAME: ReadonlyMap<string, BlockDefinition>;
/**
 * Style attributes keeping only the definition's attributes. Strings are kept when they have a value, required attributes (`required`) are kept even when empty (`""`). Booleans only when true.
 * Used in both directions, stored document (CmsNode) ↔ editor mark (serialization uses the same rule, so a round trip keeps the text the same).
 */
export declare function markAttrsOf(block: BlockDefinition, attrs: MarkAttrs | null | undefined): Record<string, CmsJsonValue>;
/** Tiptap mark for one added text style. */
export declare function createAddedMark(block: BlockDefinition, spec?: EditorMarkSpec): Mark<any, any>;
/** A style linking body text and a code line (blocks with `codeAnchor` in their attributes). If none, the code block's link tool is hidden. */
export declare const CODE_ANCHOR_REF: {
    readonly mark: string;
    readonly attribute: string;
} | null;
