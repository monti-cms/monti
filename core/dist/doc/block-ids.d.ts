import type { CmsNode } from "./types.js";
/**
 * Block ids: every block node of a stored document carries an `id` that is unique within the document. Ids are not written to MDX
 * and are not part of the content hash; they only say which block is which across versions of the same body.
 *
 * A body read from MDX (the source panel, an import, AI output, an old client) has no ids, so they are inherited from the previous
 * version of the body by pairing its blocks with the new ones (`assignBlockIds`); a block with no partner gets a new id.
 *
 * A block of a translation may also carry `sourceId`, the id of the source block it was made from (`linkedToSource`). It is kept and dropped
 * with `id`: not written to MDX, not hashed, inherited along with the id, and it names a block of another document, so it is never checked
 * against this one. When the source block's id changes, the link simply stops matching.
 */
/** 8 characters of base36. Unique within one document; documents never share an id space. */
export declare const BLOCK_ID_PATTERN: RegExp;
export declare const newBlockId: () => string;
export declare const isBlockId: (value: unknown) => value is string;
/** Calls `visit` for every block node, parents before children, with the types of its ancestor blocks. */
export declare const forEachBlock: (nodes: readonly CmsNode[], visit: (node: CmsNode, ancestors: readonly string[]) => void, ancestors?: readonly string[]) => void;
/** The same nodes with every block id and source link removed (what the content hash and document comparisons see). */
export declare const withoutBlockIds: (nodes: readonly CmsNode[]) => CmsNode[];
/**
 * Gives every block of `nodes` an id, returning new nodes. A block keeps a valid id it already has, with its source link (the first block with a
 * given id keeps it, a later copy, such as a pasted block, gets a new one and no link). A block without one inherits the id and the source link of
 * its partner in the first of `sources` that pairs it (see `pairBlocks`), as long as no other block holds that id; otherwise it gets a new id.
 */
export declare const assignBlockIds: (nodes: readonly CmsNode[], sources?: readonly (readonly CmsNode[] | null | undefined)[]) => CmsNode[];
/**
 * The same nodes with every block given a new id. Ids are unique within one document, and the translation and diff views pair blocks by them, so a body copied
 * into another (a template applied to an entry) must not bring its ids along: the copies would read as the same blocks as the original's.
 */
export declare const regenerateBlockIds: (nodes: readonly CmsNode[]) => CmsNode[];
/** Copies the block ids and source links of `from` onto `to`, which has the same tree (the same document read back). */
export declare const copyBlockIds: (to: readonly CmsNode[], from: readonly CmsNode[]) => CmsNode[];
/**
 * The blocks of a translation made from `nodes`, a source body: every block links to the source block it is a copy of (`sourceId` is that block's id)
 * and has no id of its own (the translation's blocks are its own; they get ids when it is stored).
 */
export declare const linkedToSource: (nodes: readonly CmsNode[]) => CmsNode[];
