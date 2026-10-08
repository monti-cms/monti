import { type BlockDefinition, type Site } from "@monti-cms/core/client";
import type { BlockConverter } from "../../converters/types.js";
/** Stored node type of a block used only inside a parent block (e.g. `tab`). Outside the parent it is kept as a box holding the node. */
export declare const parentOnlyTypes: (site: Pick<Site, "ADDED_BLOCKS">) => ReadonlySet<string>;
/** All added block converters. A code fence block gets that language's code block, any other block gets the node of its name. */
export declare function addedBlockConverters(all: readonly BlockDefinition[]): BlockConverter[];
/** The converters of the added blocks of a site. The same list for the same site. */
export declare const addedBlockConvertersOf: (site: Pick<Site, "ADDED_BLOCKS">) => readonly BlockConverter[];
