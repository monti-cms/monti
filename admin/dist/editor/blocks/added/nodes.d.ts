import { type BlockDefinition, type Site } from "@monti-cms/core/client";
import { Node } from "@tiptap/core";
/**
 * Tiptap node for a single added block. A container holds body content (or fixed child blocks); single-line blocks and code fence blocks are selected
 * as a whole. The edit view is chosen by `BlockNodeView`.
 */
export declare function createAddedBlockNode(block: BlockDefinition, all: readonly BlockDefinition[]): Node;
/** All added block nodes of a site. The same list for the same site, so an editor rebuilt for it keeps its extensions. */
export declare const addedBlockNodes: (site: Pick<Site, "ADDED_BLOCKS">) => readonly Node<any, any>[];
