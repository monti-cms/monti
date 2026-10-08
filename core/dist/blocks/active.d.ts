import type { BlockDefinition } from "./define.js";
import { type BlockSources } from "./resolve.js";
/** The body blocks of one site. */
export type SiteBlocks = ReturnType<typeof createBlocks>;
/**
 * The blocks a site config uses: core blocks plus the blocks added by its plugins and its own `blocks`, and the tables built from them. The definitions are plain values:
 * the labels (getters in the modules that define them) are read once, in the language the caller has set (`createSite` does it for the admin language).
 */
export declare function createBlocks(sources: BlockSources | undefined): {
    BLOCKS: readonly BlockDefinition[];
    isBlockActive: (name: string) => boolean;
    ADDED_BLOCKS: readonly BlockDefinition[];
    ADDED_MARK_BLOCKS: readonly BlockDefinition[];
    MARK_ORDER: readonly string[];
    sortMarks: <T extends {
        type: string;
    }>(marks: readonly T[]) => T[];
    BLOCK_BY_NAME: ReadonlyMap<string, BlockDefinition>;
    BLOCK_BY_COMPONENT: ReadonlyMap<string, BlockDefinition>;
    directiveBlocks: () => BlockDefinition[];
    FENCE_BLOCKS: ReadonlyMap<string, BlockDefinition>;
    fenceBlockOf: (lang: unknown) => BlockDefinition | undefined;
    childRules: () => {
        block: BlockDefinition;
        childComponents: string[];
    }[];
};
