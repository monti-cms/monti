import { type RenderDocumentOptions, type RenderedDocument } from "@monti-cms/core/render";
import type { SyntaxExtension } from "./syntax/types.js";
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
/**
 * Renders MDX text: `mdxFormat.import(source)` → `renderDocument(doc, options)`, for the site in `options.site` (`cms.site`): its blocks decide how the text reads and
 * what is drawn. Same result as `renderDocument` (`content`, `toc`, `unknown`). A text the format cannot
 * read (it does not parse, uses `import`/`export` or an expression, has front matter) is not rendered: an error is thrown, since nothing of it can be trusted.
 * Pass `refs` (`entry.refs` of a read) to draw registered images, files and internal links.
 */
export declare function renderMdx(source: string, options: RenderMdxOptions): Promise<RenderedDocument>;
export type { RenderedDocument } from "@monti-cms/core/render";
