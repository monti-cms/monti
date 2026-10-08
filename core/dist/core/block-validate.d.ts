import type { StoredDocument } from "../doc/stored-document.js";
import type { WriteOperation } from "../services/hooks.js";
import type { Site } from "../site/index.js";
import type { Issue } from "./types.js";
/**
 * Runs the `validate` slot of block definitions over a stored document: once for every node of a block that has one (a fence block is a
 * `codeBlock` node of its language, a text block is a mark, other blocks are nodes named after them). The findings are **warnings** that carry the
 * block's name (`params.block`) and the id of the block they are in (`position.blockId`), so the editor can show them next to the block.
 * Nothing here blocks a write: a check that throws is reported as a `block_validate_failed` warning and the write goes on.
 */
export interface BlockValidationRequest {
    readonly locale: string;
    readonly operation: WriteOperation;
}
/** Warnings from the `validate` of every block in the document. Empty when no block of the site has one. */
export declare function validateBlocks(site: Site, doc: StoredDocument, request: BlockValidationRequest): Promise<Issue[]>;
