import type { PluggableList } from "unified";
import { BLOCKS } from "../blocks/active";
import { BLOCK_BY_COMPONENT, BLOCK_BY_NAME } from "../blocks/derive";
import { cmsConfig } from "../config/resolved";
import type { SyntaxBlocks, SyntaxExtension } from "../syntax/types";

/** The blocks the site uses, as syntax extensions see them. */
export const syntaxBlocks: SyntaxBlocks = {
	list: BLOCKS,
	byName: (name) => BLOCK_BY_NAME.get(name),
	byComponent: (component) => BLOCK_BY_COMPONENT.get(component),
};

const NO_SYNTAX: readonly SyntaxExtension[] = [];

/** Syntax extensions of the site config (`mdx.syntax`), in precedence order. The same array every call, so parsers can be cached by it. */
export const configuredSyntax = (): readonly SyntaxExtension[] => cmsConfig.mdx?.syntax ?? NO_SYNTAX;

/** Remark plugins of the extensions (parsing). The parser and the public render chain both use them. */
export const syntaxRemarkPlugins = (extensions: readonly SyntaxExtension[]): PluggableList =>
	extensions.flatMap((extension) => {
		const { remarkPlugins } = extension;
		return typeof remarkPlugins === "function" ? remarkPlugins({ blocks: syntaxBlocks }) : (remarkPlugins ?? []);
	});
