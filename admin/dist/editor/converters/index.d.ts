import { type Site } from "@monti-cms/core/client";
import type { CmsNode } from "@monti-cms/core/document";
import type { BlockConverter } from "./types.js";
export type { BlockConverter, ConverterContext } from "./types.js";
/**
 * Block converter registry of a site. A block with an edit UI adds one more converter line here.
 * If two converters have the same `cmsTypes` or `tiptapTypes`, the registry test fails.
 * (However, detailed branch converters with `matches` may share the same cmsType.)
 */
export declare const blockConvertersOf: (site: Pick<Site, "ADDED_BLOCKS">) => readonly BlockConverter[];
export declare const converterForCms: (site: Pick<Site, "ADDED_BLOCKS">, type: string, node?: CmsNode) => BlockConverter | undefined;
export declare const converterForTiptap: (site: Pick<Site, "ADDED_BLOCKS">, type: string) => BlockConverter | undefined;
