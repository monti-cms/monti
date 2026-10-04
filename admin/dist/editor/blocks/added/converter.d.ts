import type { BlockDefinition } from "@monti-cms/core/client";
import type { BlockConverter } from "../../converters/types.js";
/** Renderer name of a block used only inside a parent block (e.g. `Tab`). Outside the parent it is kept as a raw-source preserving box. */
export declare const PARENT_ONLY_TYPES: ReadonlySet<string>;
/** All added block converters. A code fence block gets that language's code block, a directive block gets the node of its renderer name. */
export declare function addedBlockConverters(all: readonly BlockDefinition[]): BlockConverter[];
export declare const ADDED_BLOCK_CONVERTERS: readonly BlockConverter[];
