import { perSite } from "../site/per-site.js";
/** The blocks the site uses, as a format sees them. */
export const siteBlocks = perSite((site) => ({
    list: site.BLOCKS,
    byName: (name) => site.BLOCK_BY_NAME.get(name),
    byComponent: (component) => site.BLOCK_BY_COMPONENT.get(component),
}));
/** The code block line effect names the site uses. */
export const siteCodeLineEffects = perSite((site) => new Set(site.CODE_LINE_EFFECTS.map((effect) => effect.name)));
export const siteFormatContext = (site, locale) => ({
    locale,
    blocks: siteBlocks(site),
    codeLineEffects: siteCodeLineEffects(site),
    site,
});
