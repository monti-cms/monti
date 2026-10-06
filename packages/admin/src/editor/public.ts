/**
 * Editor entry point (`@monti-cms/admin/editor`). Plugins and site tests use the body MDX to editor document conversion and the editor extensions.
 */

export type {
	EditorBubblePanel,
	EditorBubbleProps,
	EditorMarkDetailProps,
	EditorMarkExtension,
} from "../admin-components";
export { MdxPreview } from "../screens/entries/source-pane";
export { addedMarkName, CODE_ANCHOR_REF, type EditorMarkSpec, type MarkAttrs, markAttrsOf } from "./added-marks";
export { BLOCK_ID_ATTRIBUTE, findBlock } from "./block-ids";
export { BLOCK_NODE_VIEWS, BLOCK_NODES } from "./block-views";
export { blockNodeName } from "./blocks/added";
export { findAnchor, startLinkFromText, unlinkRef } from "./code-block/link-commands";
export { buildEditorExtensions } from "./extensions";
export { BubbleButton } from "./inline-bubble";
export { type ActiveInlineMark, allowsMark, removeInlineMark } from "./inline-marks";
export { collapseToEnd } from "./link-form";
export { MarkTextForm, type MarkTextLabels, MarkTextPopover } from "./mark-text-form";
export { mdxToTiptap, OPAQUE_BLOCK_NAME, storedToTiptap, tiptapToMdx, tiptapToStored } from "./tiptap-content";
export { type BlockAction, CmsEditor } from "./tiptap-editor";
export { UNTRANSLATED_MARK_NAME } from "./untranslated-mark";
