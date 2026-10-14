/** The blocks and inline marks of `@monti-cms/blocks` that `monti init` offers, and the choices made among them. */
/** A body block or inline mark of `@monti-cms/blocks`, as `monti init` offers it. */
export interface BlockChoice {
    /** The name used in flags (`--blocks callout,tabs`). */
    readonly id: string;
    /** The function listed in `plugins`: exported by `@monti-cms/blocks`, or by `@monti-cms/blocks/<id>` for a block with a `needs` (the heavy ones, so the barrel never loads their library). */
    readonly fn: string;
    /** One line for the list and for the comment in the config. */
    readonly description: string;
    /** An npm package the block needs besides `@monti-cms/blocks`. */
    readonly needs?: string;
    /** Why the block is not in the default set: what it adds to the app. Set only for blocks that are opt-in. */
    readonly heavy?: string;
}
/** Every block of `@monti-cms/blocks`, in the order the plugins are listed (the inline marks last: overlapping marks are stored in this order). */
export declare const BLOCK_CHOICES: readonly BlockChoice[];
/**
 * The blocks `monti init` turns on when nobody chose: the light ones. The heavy ones (`mermaid`, `chart`) are opt-in (`--blocks all` or a list that names them),
 * because each adds a large package to the app. `columns`, `code-explorer` and `tooltip` are also left out: they are small, but a first blog rarely needs them.
 */
export declare const DEFAULT_BLOCK_IDS: readonly string[];
/** The module a block's function is imported from. */
export declare const blockEntry: (block: BlockChoice) => string;
/** The block choices for the ids, in the order of {@link BLOCK_CHOICES}. */
export declare const chosenBlocks: (ids: readonly string[]) => readonly BlockChoice[];
