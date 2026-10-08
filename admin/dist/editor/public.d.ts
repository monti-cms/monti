/**
 * Editor entry point (`@monti-cms/admin/editor`). Plugins and site tests use the stored document to editor document conversion and the editor extensions.
 */
export type { EditorBubblePanel, EditorBubbleProps, EditorMarkDetailProps, EditorMarkExtension, } from "../admin-components.js";
export { DocPreview } from "../screens/entries/source-pane.js";
export { addedMarkName, codeAnchorRef, type EditorMarkSpec, type MarkAttrs, markAttrsOf } from "./added-marks.js";
export { BLOCK_ID_ATTRIBUTE, findBlock } from "./block-ids.js";
export { BLOCK_NODES } from "./block-views.js";
export { blockNodeName } from "./blocks/added/index.js";
export { findAnchor, startLinkFromText, unlinkRef } from "./code-block/link-commands.js";
export { buildEditorExtensions } from "./extensions.js";
export { BubbleButton } from "./inline-bubble.js";
export { type ActiveInlineMark, allowsMark, removeInlineMark } from "./inline-marks.js";
export { collapseToEnd } from "./link-form.js";
export { MarkTextForm, type MarkTextLabels, MarkTextPopover } from "./mark-text-form.js";
export { OPAQUE_BLOCK_NAME, storedToTiptap, tiptapToStored } from "./tiptap-content.js";
export { type BlockAction, CmsEditor } from "./tiptap-editor.js";
export { UNTRANSLATED_MARK_NAME } from "./untranslated-mark.js";
