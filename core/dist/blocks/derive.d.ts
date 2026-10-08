import type { BlockDefinition } from "./define.js";
/**
 * Rules that read one block definition, shared by the server, editor, and public renderer. The tables built from the blocks a site uses (`BLOCK_BY_NAME`,
 * `FENCE_BLOCKS`, `childRules`, ...) belong to its `Site` (see `active.ts`).
 */
/** The attribute name when a value falls outside an attribute's allowed choices. The pre-publish check reports it as `invalid_block_attribute`. */
export declare function invalidOptionAttributes(block: BlockDefinition, attributes: Readonly<Record<string, unknown>>): string[];
/** Allowed alignment values. `justify` is not used. */
export declare const TEXT_ALIGN_VALUES: readonly ("left" | "center" | "right")[];
