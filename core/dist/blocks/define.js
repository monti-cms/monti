/**
 * Attribute names a block cannot use. The public renderer passes a block's attributes to its component as flat props next to these
 * (`children`, the stored `node`, its `blockId` and `items`, the render `ctx`, and the code of a fence block as `source`).
 */
export const RESERVED_BLOCK_ATTRIBUTES = ["children", "node", "blockId", "items", "ctx", "source"];
export const defineBlock = (definition) => definition;
