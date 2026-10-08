import { renderDocument } from "@monti-cms/core/render";
import { createMdxFormat, mdxFormat } from "./format.js";
import { configuredSyntax, siteCodeLineEffects, siteSyntaxBlocks } from "./syntax-config.js";
const importContext = ({ site, locale }) => ({
    locale: locale ?? site.DEFAULT_LOCALE,
    blocks: siteSyntaxBlocks(site),
    codeLineEffects: siteCodeLineEffects(site),
    site,
});
/**
 * Renders MDX text: `mdxFormat.import(source)` → `renderDocument(doc, options)`, for the site in `options.site` (`cms.site`): its blocks decide how the text reads and
 * what is drawn. Same result as `renderDocument` (`content`, `toc`, `unknown`). A text the format cannot
 * read (it does not parse, uses `import`/`export` or an expression, has front matter) is not rendered: an error is thrown, since nothing of it can be trusted.
 * Pass `refs` (`entry.refs` of a read) to draw registered images, files and internal links.
 */
export async function renderMdx(source, options) {
    const { syntax, ...rest } = options;
    const extensions = syntax ?? configuredSyntax(options.site);
    const format = extensions.length > 0 ? createMdxFormat({ syntax: extensions }) : mdxFormat;
    const read = await format.import?.(source, importContext(options));
    if (!read)
        throw new Error("The mdx format cannot read text");
    if (!read.ok) {
        throw new Error(`MDX validation failed: ${read.issues[0]?.message ?? read.issues[0]?.code ?? "unknown"}`);
    }
    return renderDocument(read.doc, rest);
}
