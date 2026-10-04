/**
 * Tools for building block editing views (`@monti-cms/admin/blocks`). Used when a block extension draws the whole editing view (`blockViews`).
 */
export { blockNodeName } from "./added/shared.js";
export type { CustomBlockEditorProps } from "./added/view.js";
export { type FenceEditorMeta, FencePreviewNodeView, LazyFencePreview } from "./fence-preview/index.js";
export { AttributeInput, BLOCK_TOOLBAR, BlockSettings, BlockSettingsField, ContainerToolbar, type ContainerValues, childPos, focusInside, SELECTED_RING, selectContainer, ToolbarButton, useContainerValues, useSelectedChildIndex, valuesOf, withValue, } from "./shared.js";
