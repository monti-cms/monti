import type { Root } from "mdast";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { VFile } from "vfile";
import { remarkDemoteUnknownDirectives, remarkDirectivesToMdx } from "./remark-directives";

/**
 * CMS body parser. It uses the same remark setup as the site's public render (MDX renderer)
 * so that interpretation does not diverge.
 *
 * `remark-directive` turns every `:name` into a directive node regardless of registration.
 * So {@link remarkDemoteUnknownDirectives} immediately **turns unregistered names back into body text**,
 * and then {@link remarkDirectivesToMdx} turns registered names into MDX elements.
 *
 * **The stored string does not change here** — only the tree takes the same shape as the public chain. The reason is
 * that consumers of the analyzer look up nodes by name: collecting media references of `::image{mediaId}`,
 * validating the child count of `Tabs` and `Columns`, and validating event handler and expression attributes do not
 * need separate code for directives (splitting into two shapes leads to fixing only one of them).
 */
const processor = unified()
	.use(remarkParse)
	.use(remarkMdx)
	.use(remarkGfm)
	.use(remarkMath, { singleDollarTextMath: false })
	.use(remarkDirective)
	.use(remarkDemoteUnknownDirectives)
	.use(remarkDirectivesToMdx);

export const parseMdxAst = (body: string): Root => {
	// Single `$` inline math is turned off. Symbols like jQuery `$` are common in body text; if mistaken for math,
	// interpretation diverges from the public renderer (remarkDisableInlineMath) and the round trip breaks. Block `$$` math is kept.
	const file = new VFile({ value: body });
	const tree = processor.parse(file);

	// Both plugins are transformers. Calling only `.parse()` does not run them,
	// so unregistered names stay as directives and registered names do not become MDX elements.
	processor.runSync(tree, file);

	return tree as Root;
};
