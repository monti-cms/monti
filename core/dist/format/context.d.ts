import type { Site } from "../site/index.js";
import type { BlockCatalog, FormatContext } from "./types.js";
/**
 * What core gives every format to work with, from the site: its blocks, its code line effects and the site itself. Only the code that calls a format (`convert.ts`) imports it;
 * `@monti-cms/core/format` stays free of it.
 */
/** The parts of a site a format sees. */
export type FormatSite = Pick<Site, "BLOCKS" | "BLOCK_BY_NAME" | "BLOCK_BY_COMPONENT" | "CODE_LINE_EFFECTS">;
/** The blocks the site uses, as a format sees them. */
export declare const siteBlocks: (site: FormatSite) => BlockCatalog;
/** The code block line effect names the site uses. */
export declare const siteCodeLineEffects: (site: FormatSite) => ReadonlySet<string>;
export declare const siteFormatContext: (site: Site, locale: string) => FormatContext;
