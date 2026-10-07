import type { Site } from "@monti-cms/core/client";
import type { PluggableList } from "unified";
import { perSite } from "./per-site";
import { MDX_PLUGIN_NAME, type MdxPluginOptions } from "./plugin";
import type { SyntaxBlocks, SyntaxExtension } from "./syntax/types";

/** The blocks the site uses, as syntax extensions see them. */
export const siteSyntaxBlocks = perSite(
	(site: Site): SyntaxBlocks => ({
		list: site.BLOCKS,
		byName: (name) => site.BLOCK_BY_NAME.get(name),
		byComponent: (component) => site.BLOCK_BY_COMPONENT.get(component),
	}),
);

/** The code block line effect names the site uses, as syntax extensions see them. */
export const siteCodeLineEffects = perSite(
	(site: Site): ReadonlySet<string> => new Set(site.CODE_LINE_EFFECTS.map((effect) => effect.name)),
);

/** No syntax extension: standard MDX (CommonMark + GFM + standard MDX JSX). The same array every time, so parsers can be cached by it. */
export const NO_SYNTAX: readonly SyntaxExtension[] = [];

/** The syntax extensions the site gave to `mdx({ syntax })`, in precedence order (none when the site config has no `mdx()` plugin). */
export const configuredSyntax = (site: Pick<Site, "getPluginOptions">): readonly SyntaxExtension[] =>
	site.getPluginOptions<MdxPluginOptions>(MDX_PLUGIN_NAME)?.syntax ?? NO_SYNTAX;

/** Remark plugins of the extensions (parsing), built for the site's blocks and line effects. The parser and the public render chain both use them. */
export const syntaxRemarkPlugins = (site: Site, extensions: readonly SyntaxExtension[]): PluggableList => {
	const blocks = siteSyntaxBlocks(site);
	const codeLineEffects = siteCodeLineEffects(site);
	return extensions.flatMap((extension) => {
		const { remarkPlugins } = extension;
		return typeof remarkPlugins === "function" ? remarkPlugins({ blocks, codeLineEffects }) : (remarkPlugins ?? []);
	});
};
