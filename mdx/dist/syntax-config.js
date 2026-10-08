import { perSite } from "./per-site.js";
import { MDX_PLUGIN_NAME } from "./plugin.js";
/** The blocks the site uses, as syntax extensions see them. */
export const siteSyntaxBlocks = perSite((site) => ({
    list: site.BLOCKS,
    byName: (name) => site.BLOCK_BY_NAME.get(name),
    byComponent: (component) => site.BLOCK_BY_COMPONENT.get(component),
}));
/** The code block line effect names the site uses, as syntax extensions see them. */
export const siteCodeLineEffects = perSite((site) => new Set(site.CODE_LINE_EFFECTS.map((effect) => effect.name)));
/** No syntax extension: standard MDX (CommonMark + GFM + standard MDX JSX). The same array every time, so parsers can be cached by it. */
export const NO_SYNTAX = [];
/** The syntax extensions the site gave to `mdx({ syntax })`, in precedence order (none when the site config has no `mdx()` plugin). */
export const configuredSyntax = (site) => site.getPluginOptions(MDX_PLUGIN_NAME)?.syntax ?? NO_SYNTAX;
/** Remark plugins of the extensions (parsing), built for the site's blocks and line effects. The parser and the public render chain both use them. */
export const syntaxRemarkPlugins = (site, extensions) => {
    const blocks = siteSyntaxBlocks(site);
    const codeLineEffects = siteCodeLineEffects(site);
    return extensions.flatMap((extension) => {
        const { remarkPlugins } = extension;
        return typeof remarkPlugins === "function" ? remarkPlugins({ blocks, codeLineEffects }) : (remarkPlugins ?? []);
    });
};
