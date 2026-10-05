import type { PluggableList } from "unified";
import { CODE_LINE_EFFECTS } from "../annotation/code-block/active";
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

/** The code block line effect names the site uses, as syntax extensions see them. */
export const syntaxCodeLineEffects: ReadonlySet<string> = new Set(CODE_LINE_EFFECTS.map((effect) => effect.name));

const NO_SYNTAX: readonly SyntaxExtension[] = [];

/** Syntax extensions of the site config (`mdx.syntax`), in precedence order. The same array every call, so parsers can be cached by it. */
export const configuredSyntax = (): readonly SyntaxExtension[] => cmsConfig.mdx?.syntax ?? NO_SYNTAX;

/** Remark plugins of the extensions (parsing). The parser and the public render chain both use them. */
export const syntaxRemarkPlugins = (extensions: readonly SyntaxExtension[]): PluggableList =>
	extensions.flatMap((extension) => {
		const { remarkPlugins } = extension;
		return typeof remarkPlugins === "function"
			? remarkPlugins({ blocks: syntaxBlocks, codeLineEffects: syntaxCodeLineEffects })
			: (remarkPlugins ?? []);
	});
