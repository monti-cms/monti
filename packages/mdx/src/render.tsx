import { DEFAULT_LOCALE } from "@monti-cms/core/client";
import type { FormatImportContext } from "@monti-cms/core/format";
import { type RenderDocumentOptions, type RenderedDocument, renderDocument } from "@monti-cms/core/render";
import { createMdxFormat, mdxFormat } from "./format";
import type { SyntaxExtension } from "./syntax/types";
import { configuredSyntax, siteCodeLineEffects, siteSyntaxBlocks } from "./syntax-config";

/**
 * Public rendering of MDX text (`@monti-cms/mdx/render`). The text is read into a stored document by the `mdx` format and the document is drawn by core's
 * renderer, so the page uses the same components whichever format the body was read in, and no MDX is compiled or executed on the public path.
 */

export interface RenderMdxOptions extends RenderDocumentOptions {
	/**
	 * The syntax extensions the text is read with (`directiveSyntax()`). Default: the ones the site config gave to `mdx({ syntax })`. A text written in an
	 * extension's notation is read only with it.
	 */
	readonly syntax?: readonly SyntaxExtension[];
}

const importContext = (locale: string | undefined): FormatImportContext => ({
	locale: locale ?? DEFAULT_LOCALE,
	blocks: siteSyntaxBlocks,
	codeLineEffects: siteCodeLineEffects,
});

/**
 * Renders MDX text: `mdxFormat.import(source)` → `renderDocument(doc, options)`. Same result as `renderDocument` (`content`, `toc`, `unknown`). A text the format cannot
 * read (it does not parse, uses `import`/`export` or an expression, has front matter) is not rendered: an error is thrown, since nothing of it can be trusted.
 * Pass `refs` (`entry.refs` of a read) to draw registered images, files and internal links.
 */
export async function renderMdx(source: string, options: RenderMdxOptions = {}): Promise<RenderedDocument> {
	const { syntax, ...rest } = options;
	const extensions = syntax ?? configuredSyntax();
	const format = extensions.length > 0 ? createMdxFormat({ syntax: extensions }) : mdxFormat;
	const read = await format.import?.(source, importContext(options.locale));
	if (!read) throw new Error("The mdx format cannot read text");
	if (!read.ok) {
		throw new Error(`MDX validation failed: ${read.issues[0]?.message ?? read.issues[0]?.code ?? "unknown"}`);
	}
	return renderDocument(read.doc, rest);
}

export type { RenderedDocument } from "@monti-cms/core/render";
