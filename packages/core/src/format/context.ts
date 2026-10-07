import type { Site } from "../site";
import { perSite } from "../site/per-site";
import type { BlockCatalog, FormatContext } from "./types";

/**
 * What core gives every format to work with, from the site: its blocks and code line effects. Only the code that calls a format (`convert.ts`) imports it;
 * `@monti-cms/core/format` stays free of it.
 */

/** The parts of a site a format sees. */
export type FormatSite = Pick<Site, "BLOCKS" | "BLOCK_BY_NAME" | "BLOCK_BY_COMPONENT" | "CODE_LINE_EFFECTS">;

/** The blocks the site uses, as a format sees them. */
export const siteBlocks = perSite(
	(site: FormatSite): BlockCatalog => ({
		list: site.BLOCKS,
		byName: (name) => site.BLOCK_BY_NAME.get(name),
		byComponent: (component) => site.BLOCK_BY_COMPONENT.get(component),
	}),
);

/** The code block line effect names the site uses. */
export const siteCodeLineEffects = perSite(
	(site: FormatSite): ReadonlySet<string> => new Set(site.CODE_LINE_EFFECTS.map((effect) => effect.name)),
);

export const siteFormatContext = (site: FormatSite, locale: string): FormatContext => ({
	locale,
	blocks: siteBlocks(site),
	codeLineEffects: siteCodeLineEffects(site),
});
