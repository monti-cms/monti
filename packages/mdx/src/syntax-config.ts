import { BLOCK_BY_COMPONENT, BLOCK_BY_NAME, BLOCKS, getPluginOptions } from "@monti-cms/core/client";
import { CODE_LINE_EFFECTS } from "@monti-cms/core/code-block";
import type { PluggableList } from "unified";
import { MDX_PLUGIN_NAME, type MdxPluginOptions } from "./plugin";
import type { SyntaxBlocks, SyntaxExtension } from "./syntax/types";

/** The blocks the site uses, as syntax extensions see them. */
export const siteSyntaxBlocks: SyntaxBlocks = {
	list: BLOCKS,
	byName: (name) => BLOCK_BY_NAME.get(name),
	byComponent: (component) => BLOCK_BY_COMPONENT.get(component),
};

/** The code block line effect names the site uses, as syntax extensions see them. */
export const siteCodeLineEffects: ReadonlySet<string> = new Set(CODE_LINE_EFFECTS.map((effect) => effect.name));

/** No syntax extension: standard MDX (CommonMark + GFM + standard MDX JSX). The same array every time, so parsers can be cached by it. */
export const NO_SYNTAX: readonly SyntaxExtension[] = [];

/** The syntax extensions the site gave to `mdx({ syntax })`, in precedence order (none when the site config has no `mdx()` plugin). */
export const configuredSyntax = (): readonly SyntaxExtension[] =>
	getPluginOptions<MdxPluginOptions>(MDX_PLUGIN_NAME)?.syntax ?? NO_SYNTAX;

/** Remark plugins of the extensions (parsing). The parser and the public render chain both use them. */
export const syntaxRemarkPlugins = (
	extensions: readonly SyntaxExtension[],
	blocks: SyntaxBlocks = siteSyntaxBlocks,
	codeLineEffects: ReadonlySet<string> = siteCodeLineEffects,
): PluggableList =>
	extensions.flatMap((extension) => {
		const { remarkPlugins } = extension;
		return typeof remarkPlugins === "function" ? remarkPlugins({ blocks, codeLineEffects }) : (remarkPlugins ?? []);
	});
