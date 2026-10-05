/**
 * Tools for building block editing views (`@monti-cms/admin/blocks`). Used when a block extension draws the whole editing view (`blockViews`).
 */

export { formatMeta, parseMeta } from "../code-block/meta";
export { blockNodeName } from "./added/shared";
export type { CustomBlockEditorProps } from "./added/view";
export { type FenceEditorMeta, FencePreviewNodeView, LazyFencePreview } from "./fence-preview";
export {
	AttributeInput,
	BLOCK_TOOLBAR,
	BlockSettings,
	BlockSettingsField,
	ContainerToolbar,
	type ContainerValues,
	childPos,
	focusInside,
	SELECTED_RING,
	selectContainer,
	ToolbarButton,
	useContainerValues,
	useEditorEditable,
	useSelectedChildIndex,
	valuesOf,
	withValue,
} from "./shared";
