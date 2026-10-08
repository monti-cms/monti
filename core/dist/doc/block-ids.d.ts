import type { CmsNode } from "./types.js";
/**
 * Block ids: every block node of a stored document carries an `id` that is unique within the document. Ids are not written to MDX
 * and are not part of the content hash; they only say which block is which across versions of the same body.
 *
 * A body read from MDX (the source panel, an import, AI output, an old client) has no ids, so they are inherited from the previous
 * version of the body by pairing its blocks with the new ones (`assignBlockIds`); a block with no partner gets a new id.
 */
/** 8 characters of base36. Unique within one document; documents never share an id space. */
export declare const BLOCK_ID_PATTERN: RegExp;
export declare const newBlockId: () => string;
export declare const isBlockId: (value: unknown) => value is string;
/** Calls `visit` for every block node, parents before children, with the types of its ancestor blocks. */
export declare const forEachBlock: (nodes: readonly CmsNode[], visit: (node: CmsNode, ancestors: readonly string[]) => void, ancestors?: readonly string[]) => void;
/** The same nodes with every block id removed (what the content hash and document comparisons see). */
export declare const withoutBlockIds: (nodes: readonly CmsNode[]) => CmsNode[];
/**
 * Gives every block of `nodes` an id, returning new nodes. A block keeps a valid id it already has (the first block with a given id
 * keeps it, a later copy, such as a pasted block, gets a new one). A block without one inherits the id of its partner in the first of
 * `sources` that pairs it (see `pairBlocks`), as long as no other block holds that id; otherwise it gets a new id.
 */
export declare const assignBlockIds: (nodes: readonly CmsNode[], sources?: readonly (readonly CmsNode[] | null | undefined)[]) => CmsNode[];
/**
 * The same nodes with every block given a new id. Ids are unique within one document, and the translation and diff views pair blocks by them, so a body copied
 * into another (a template applied to an entry) must not bring its ids along: the copies would read as the same blocks as the original's.
 */
export declare const regenerateBlockIds: (nodes: readonly CmsNode[]) => CmsNode[];
/** Copies the block ids of `from` onto `to`, which has the same tree (the same document read back). */
export declare const copyBlockIds: (to: readonly CmsNode[], from: readonly CmsNode[]) => CmsNode[];
