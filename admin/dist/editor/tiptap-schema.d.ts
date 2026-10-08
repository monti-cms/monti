import { type Site } from "@monti-cms/core/client";
import { Node } from "@tiptap/core";
/**
 * A read-only box that preserves CMS blocks not in the Tiptap schema (a block without an edit view, a merged table with block content, a body that could
 * not be read, etc.).
 *
 * `attrs.node` holds the stored node of that subtree as JSON. On save, the box is read again and spliced back in, so the content never changes
 * (nodes are never silently deleted). As an `atom`, the inside of the box is not editable; it can only be selected and deleted as a whole.
 */
export declare const cmsOpaqueBlock: (site: Pick<Site, "createTranslator">) => Node<any, any>;
/**
 * Inline and alignment extensions for the new representation contract.
 *
 * Write commands are enabled — the editor saves through the `toDocument`/`serialize` path,
 * so the read/write switch is atomic.
 *
 * `alignments` does not include `justify`. The public renderer supports only `left`, `center`, and `right` with fixed classes.
 * Tiptap internally uses inline `style` (extension default) but the stored format is `:::text-align{align=...}`.
 */
export declare const CmsTextAlign: import("@tiptap/core").Extension<import("@tiptap/extension-text-align").TextAlignOptions, any>;
export declare const CmsSuperscript: import("@tiptap/core").Mark<import("@tiptap/extension-superscript").SuperscriptExtensionOptions, any>;
export declare const CmsSubscript: import("@tiptap/core").Mark<import("@tiptap/extension-subscript").SubscriptExtensionOptions, any>;
/**
 * Table (basic table with row/column add/delete, cell merging, column widths).
 * A table with adjusted column widths is stored as a `<Table widths="...">` element (or a table directive when the site uses the directive extension).
 * Dragging within `handleWidth` (px) on either side of a column boundary adjusts the width. The default 5px was hard to grab, so it is widened.
 */
export declare const CmsTable: Node<import("@tiptap/extension-table").TableOptions, any>;
/** `- [ ]` and `- [x]` checklists. */
export declare const CmsTaskItem: Node<import("@tiptap/extension-list").TaskItemOptions, any>;
/** The schema extensions of a site. The same list for the same site, so an editor rebuilt for it keeps its extensions. */
export declare const cmsSchemaExtensions: (site: Site) => (import("@tiptap/core").Extension<any, any> | import("@tiptap/core").Extension<import("@tiptap/extension-text-align").TextAlignOptions, any> | import("@tiptap/core").Mark<any, any> | import("@tiptap/core").Mark<import("@tiptap/extension-subscript").SubscriptExtensionOptions, any> | Node<any, any> | Node<import("@tiptap/extension-code-block").CodeBlockOptions, any> | Node<import("@tiptap/extension-table").TableCellOptions, any> | Node<import("@tiptap/extension-table").TableOptions, any> | Node<import("@tiptap/extension-list").TaskItemOptions, any> | Node<import("@tiptap/extension-list").TaskListOptions, any>)[];
