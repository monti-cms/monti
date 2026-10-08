import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
/** Editor attribute that holds a block's id (`CmsNode.id`). Not called `id`, which some nodes may want for themselves. */
export declare const BLOCK_ID_ATTRIBUTE = "blockId";
/**
 * Block ids in the editor. Every block node carries the id of its block in the stored document, so a save can send the document with
 * the ids it was loaded with and blocks keep them exactly (the server only pairs blocks up when it is sent MDX).
 *
 * - Splitting a block (Enter) does not copy the id: the first part keeps it and the new block gets one (`keepOnSplit: false`).
 * - After every change, a block without a valid id, or with the id of an earlier block (a pasted, duplicated or dragged copy), gets a new one.
 * - The id is not rendered: copied HTML carries none, so a pasted block always gets a new one. A block is found by its id in the document
 *   (`findBlock`), not in the page.
 */
export declare const CmsBlockIds: Extension<any, any>;
/** Position of the block with this id in a document, or `undefined`. */
export declare const findBlock: (doc: ProseMirrorNode, id: string) => number | undefined;
