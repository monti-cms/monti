/**
 * 편집기 진입점(`@monti-cms/admin/editor`). 본문 MDX ↔ 편집기 문서 변환과 편집기 확장을 플러그인·사이트 테스트가 쓴다.
 */

export type {
	EditorBubblePanel,
	EditorBubbleProps,
	EditorMarkDetailProps,
	EditorMarkExtension,
} from "../admin-components";
export { MdxPreview } from "../screens/entries/source-pane";
export { addedMarkName, CODE_ANCHOR_REF, type EditorMarkSpec, type MarkAttrs, markAttrsOf } from "./added-marks";
export { BLOCK_NODE_VIEWS } from "./block-views";
export { blockNodeName } from "./blocks/added";
export { findAnchor, startLinkFromText, unlinkRef } from "./code-block/link-commands";
export { buildEditorExtensions } from "./extensions";
export { BubbleButton } from "./inline-bubble";
export { type ActiveInlineMark, allowsMark, removeInlineMark } from "./inline-marks";
export { collapseToEnd } from "./link-form";
export { MarkTextForm, type MarkTextLabels, MarkTextPopover } from "./mark-text-form";
export { mdxToTiptap, OPAQUE_BLOCK_NAME, tiptapToMdx } from "./tiptap-content";
export { type BlockAction, CmsEditor } from "./tiptap-editor";
export { UNTRANSLATED_MARK_NAME } from "./untranslated-mark";
