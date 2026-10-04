/**
 * 블록 편집 화면을 만드는 도구(`@monti-cms/admin/blocks`). 블록 확장이 편집 화면 전체(`blockViews`)를 그릴 때 쓴다.
 */

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
	useSelectedChildIndex,
	valuesOf,
	withValue,
} from "./shared";
