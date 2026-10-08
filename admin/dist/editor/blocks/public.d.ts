/**
 * UI for building block editing views (`@monti-cms/admin/blocks`): the toolbar, the settings popover and the attribute input.
 * A block view reads and writes its block with `useBlockEditor` and draws its nested body with `Content` (`@monti-cms/admin/hooks`);
 * register the view by block name in `blockViews`.
 */
export { formatMeta, parseMeta } from "../code-block/meta.js";
export { blockNodeName } from "./added/shared.js";
export { DEFAULT_BLOCK_VIEWS } from "./block-node-view.js";
export { type FenceEditorMeta, FencePreviewBlockView, LazyFencePreview } from "./fence-preview/index.js";
export { AttributeInput, BLOCK_TOOLBAR, BlockSettings, BlockSettingsField, ContainerToolbar, SELECTED_RING, ToolbarButton, } from "./shared.js";
