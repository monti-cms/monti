"use client";

import { type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useCmsAdminComponents } from "../../admin-components";
import { FileBlockView } from "../file-node-view";
import { ImageBlockView } from "../image-node-view";
import { DefaultBlockView, FenceBlockView } from "./added/view";
import { MathBlockView } from "./fence-preview";
import { blockOfNode } from "./node-block";
import { BlockEditorProvider, type BlockView } from "./use-block-editor";

/**
 * Default edit views of the core blocks, keyed by block name. They sit under the site's `blockViews` (`CmsAdminComponents`), so registering
 * a view with one of these names replaces it. Exported so a replacement can render the default view inside its own frame.
 */
export const DEFAULT_BLOCK_VIEWS: Readonly<Record<string, BlockView>> = {
	image: ImageBlockView,
	file: FileBlockView,
	math: MathBlockView,
};

/**
 * The one node view of every block with an edit view: image, file, math, and the blocks added by block extensions or site config. It looks the
 * view up by block name in `blockViews` (falling back to the default view of a core block, a code preview for a fence block, and an
 * attribute-and-body box for any other added block) and renders it inside the block's `useBlockEditor` context.
 */
export function BlockNodeView(props: NodeViewProps) {
	const definition = blockOfNode(props.node.type.name);
	const { blockViews } = useCmsAdminComponents();
	if (!definition) return <NodeViewWrapper />;
	const View =
		blockViews?.[definition.name] ??
		DEFAULT_BLOCK_VIEWS[definition.name] ??
		(definition.syntax.kind === "fence" ? FenceBlockView : DefaultBlockView);
	return (
		<BlockEditorProvider nodeView={props} definition={definition}>
			<View />
		</BlockEditorProvider>
	);
}
