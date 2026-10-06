import type { BlockDefinition } from "@monti-cms/core/client";
import type { NodeViewProps } from "@tiptap/react";
import { BlockEditorProvider, type BlockView } from "../editor/blocks/use-block-editor";

/**
 * Renders a block view without a Tiptap node view renderer: the view gets its `useBlockEditor` context from the node view props a test builds
 * by hand (a fake node, a fake `updateAttributes`). For tests of one view; a test of how views and the document work together mounts a real editor.
 */
export const withBlockEditor = (View: BlockView, definition: BlockDefinition) => (props: NodeViewProps) => (
	<BlockEditorProvider nodeView={props} definition={definition}>
		<View />
	</BlockEditorProvider>
);
