import type { BlockDefinition } from "@monti-cms/core/client";
import { Node } from "@tiptap/core";
/**
 * Tiptap node for a single added block. A container holds body content (or fixed child blocks); single-line blocks and code fence blocks are selected
 * as a whole. The edit view is chosen by `AddedBlockNodeView`.
 */
export declare function createAddedBlockNode(block: BlockDefinition, all: readonly BlockDefinition[]): Node;
/** All added block nodes. */
export declare const ADDED_BLOCK_NODES: readonly Node[];
