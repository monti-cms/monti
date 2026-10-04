import type { CmsNode } from "@monti-cms/core/mdx";
import type { BlockConverter } from "./types.js";
export type { BlockConverter, ConverterContext } from "./types.js";
/**
 * Block converter registry. A block with an edit UI adds one more converter line here.
 * If two converters have the same `cmsTypes` or `tiptapTypes`, the registry test fails.
 * (However, detailed branch converters with `matches` may share the same cmsType.)
 */
export declare const BLOCK_CONVERTERS: readonly BlockConverter[];
export declare const converterForCms: (type: string, node?: CmsNode) => BlockConverter | undefined;
export declare const converterForTiptap: (type: string) => BlockConverter | undefined;
