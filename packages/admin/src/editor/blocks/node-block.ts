import { type BlockDefinition, file, image, math } from "@monti-cms/core/client";
import { addedBlockOfNode } from "./added/shared";

/**
 * Editor node name to block definition for the core blocks that have a dedicated view. The names are the Tiptap node names of
 * `CmsImageNode`, `CmsFileNode` and `CmsMathNode`; the definitions' `editor.nodeView` names (`image`, `file`, `math`) are the registry keys.
 */
const CORE_BLOCK_BY_NODE: ReadonlyMap<string, BlockDefinition> = new Map<string, BlockDefinition>([
	["image", image],
	["cmsFile", file],
	["cmsMath", math],
]);

/** The block definition an editor node renders: a core block with its own view, or an added block (block extension or site config). */
export const blockOfNode = (nodeName: string): BlockDefinition | undefined =>
	CORE_BLOCK_BY_NODE.get(nodeName) ?? addedBlockOfNode(nodeName);
