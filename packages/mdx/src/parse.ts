import type { Site } from "@monti-cms/core/client";
import type { Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { VFile } from "vfile";
import { perSite } from "./per-site";
import { remarkBreakNewline } from "./remark-break-newline";
import type { SyntaxExtension } from "./syntax/types";
import { NO_SYNTAX, syntaxRemarkPlugins } from "./syntax-config";

/**
 * CMS body parser. It uses the same remark setup as the site's public render (MDX renderer)
 * so that interpretation does not diverge.
 *
 * It reads CommonMark, GFM and standard MDX. Anything else (for example directives) is read by the plugins of the site's syntax extensions
 * (`mdx({ syntax })`), which turn their syntax into MDX elements, so the tree the analyzer sees has the same shape whichever notation was used.
 *
 * **The stored string does not change here** — only the tree takes the same shape as the public chain. The reason is
 * that consumers of the analyzer look up nodes by name: collecting media references of `<Image mediaId>`,
 * validating the child count of `Tabs` and `Columns`, and validating event handler and expression attributes do not
 * need separate code per notation (splitting into two shapes leads to fixing only one of them).
 */
const processorFor = (site: Site, syntax: readonly SyntaxExtension[]) =>
	unified()
		.use(remarkParse)
		.use(remarkMdx)
		.use(remarkGfm)
		.use(remarkMath, { singleDollarTextMath: false })
		.use(syntaxRemarkPlugins(site, syntax))
		.use(remarkBreakNewline);

/** The parsers of a site, one for each list of syntax extensions it is asked to read with. */
const processorsOf = perSite(() => new WeakMap<readonly SyntaxExtension[], ReturnType<typeof processorFor>>());

/** `syntax` is the syntax extensions to read with (none: standard MDX). The site's are `configuredSyntax(site)`. */
export const parseMdxAst = (site: Site, body: string, syntax: readonly SyntaxExtension[] = NO_SYNTAX): Root => {
	const processors = processorsOf(site);
	let processor = processors.get(syntax);
	if (!processor) {
		processor = processorFor(site, syntax);
		processors.set(syntax, processor);
	}
	// Single `$` inline math is turned off. Symbols like jQuery `$` are common in body text; if mistaken for math,
	// interpretation diverges from the public renderer (remarkDisableInlineMath) and the round trip breaks. Block `$$` math is kept.
	const file = new VFile({ value: body });
	const tree = processor.parse(file);

	// The plugins are transformers. Calling only `.parse()` does not run them,
	// so extension syntax would stay as the extension's own nodes and not become MDX elements.
	processor.runSync(tree, file);

	return tree as Root;
};
