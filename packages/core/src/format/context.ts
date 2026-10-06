import { CODE_LINE_EFFECTS } from "../annotation/code-block/active";
import { BLOCKS } from "../blocks/active";
import { BLOCK_BY_COMPONENT, BLOCK_BY_NAME } from "../blocks/derive";
import type { BlockCatalog, FormatContext } from "./types";

/**
 * What core gives every format to work with, from the site config: its blocks and code line effects. This module reads the site config, so only the
 * code that calls a format (`convert.ts`) imports it; `@monti-cms/core/format` stays free of it.
 */

/** The blocks the site uses, as a format sees them. */
export const siteBlocks: BlockCatalog = {
	list: BLOCKS,
	byName: (name) => BLOCK_BY_NAME.get(name),
	byComponent: (component) => BLOCK_BY_COMPONENT.get(component),
};

/** The code block line effect names the site uses. */
export const siteCodeLineEffects: ReadonlySet<string> = new Set(CODE_LINE_EFFECTS.map((effect) => effect.name));

export const siteFormatContext = (locale: string): FormatContext => ({
	locale,
	blocks: siteBlocks,
	codeLineEffects: siteCodeLineEffects,
});
