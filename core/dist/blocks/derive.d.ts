import type { BlockDefinition } from "./define.js";
/**
 * Builds the storage syntax table, validation rules, and constants from the block definitions the site uses. Shared by the server, editor, and public renderer.
 */
export declare const BLOCK_BY_NAME: ReadonlyMap<string, BlockDefinition>;
/** Public renderer name (JSX name) → block definition. */
export declare const BLOCK_BY_COMPONENT: ReadonlyMap<string, BlockDefinition>;
/** Directive-syntax blocks (`:::`, `::`, `:`). Code fences and math use Markdown syntax, so they are not in the directive table. */
export declare const directiveBlocks: () => BlockDefinition[];
/** Added code fence blocks. Fence language → block definition. */
export declare const FENCE_BLOCKS: ReadonlyMap<string, BlockDefinition>;
/** The added block for a code fence language. Case-insensitive. */
export declare const fenceBlockOf: (lang: unknown) => BlockDefinition | undefined;
/** The attribute name when a value falls outside an attribute's allowed choices. The pre-publish check reports it as `invalid_block_attribute`. */
export declare function invalidOptionAttributes(block: BlockDefinition, attributes: Readonly<Record<string, unknown>>): string[];
/** Blocks with child block rules (name, count) and their children's renderer names. The storage check counts them. */
export declare const childRules: () => {
    block: BlockDefinition;
    childComponents: string[];
}[];
/** Allowed alignment values. `justify` is not used. */
export declare const TEXT_ALIGN_VALUES: readonly ("left" | "center" | "right")[];
