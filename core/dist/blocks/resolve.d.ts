import { type BlockDefinition } from "./define.js";
/**
 * Decides the body blocks the site uses: core blocks, then blocks added by plugins (block extensions), then the site config's `blocks`.
 *
 * Added blocks are directive blocks (`container`, `leaf`), text marks (`text` + `editor.view: "mark"`), and code fence blocks (`fence`).
 * A code fence block takes all code fences of its language, so ordinary code language names (`ts` etc.) are not used. For text marks, add order is the order
 * overlapping marks are stored (outermost first).
 *
 * If the extension for a block in use is removed, that block drops out of the storage syntax, and already-written body content turns into plain text when saved again.
 */
/** Who adds blocks: the site config and its plugins. */
export interface BlockSources {
    readonly blocks?: readonly BlockDefinition[];
    readonly plugins?: readonly {
        readonly name: string;
        readonly blocks?: readonly BlockDefinition[];
    }[];
}
/** Added blocks (in plugin order, then the site config). */
export declare function addedBlocks(sources: BlockSources | undefined): {
    readonly where: string;
    readonly block: BlockDefinition;
}[];
/** The block list for the config. Throws an error for an invalid config. */
export declare function resolveBlocks(sources: BlockSources | undefined): readonly BlockDefinition[];
