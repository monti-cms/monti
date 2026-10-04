import { jsx as _jsx } from "react/jsx-runtime";
import { compileMDX } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkBreaks from "remark-breaks";
import remarkDirective from "remark-directive";
import remarkFlexibleToc from "remark-flexible-toc";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { visit } from "unist-util-visit";
import { annotationConfig } from "../annotation/code-block/active.js";
import { cmsConfig } from "../config/resolved.js";
import { analyze } from "../mdx/analyze.js";
import { remarkDemoteUnknownDirectives, remarkDirectivesToMdx } from "../mdx/remark-directives.js";
import { remarkFenceBlocksToMdx } from "../mdx/remark-fence-blocks.js";
import { rehypeShikiDecorationRender, remarkAnnotationToShikiDecoration } from "./code/index.js";
import { CmsCodeCollapse, CmsCodeFold } from "./components/code-lines.js";
import { CmsFile } from "./components/file.js";
import { CmsImage } from "./components/image.js";
import { CmsLink } from "./components/link.js";
import { CmsPre } from "./components/pre.js";
import { CmsTable, CmsTableCell, CmsTableRow } from "./components/table.js";
import { CmsTextAlign } from "./components/text-align.js";
const DEFAULT_LABELS = {
    imageUnavailable: "Image unavailable",
    fileUnavailable: "File unavailable",
    download: "Download",
    showFoldedCode: "Show folded code",
    copyCode: "Copy",
    copied: "Copied",
    codeNotes: "Code notes",
};
/** A single `$` in the body is not treated as math (same as the editor parser). `$…$` is turned back into text. */
const remarkDisableInlineMath = () => (tree) => {
    visit(tree, "inlineMath", (node, index, parent) => {
        if (index == null || !parent)
            return;
        parent.children.splice(index, 1, { type: "text", value: `$${node.value}$` });
    });
};
/** Core remark order. The editor and the review runner use the same setup. */
export const mdxRemarkPlugins = (tocRef = []) => [
    [remarkAnnotationToShikiDecoration, annotationConfig],
    [remarkMath, { singleDollarTextMath: false }],
    remarkDisableInlineMath,
    // Turn unregistered directives back into body text, then turn only registered names into MDX elements (changing the order makes unregistered names disappear).
    remarkDirective,
    remarkDemoteUnknownDirectives,
    remarkDirectivesToMdx,
    // Code fence blocks (charts, diagrams etc.) are turned into `<block source="…"/>`.
    remarkFenceBlocksToMdx,
    remarkBreaks,
    remarkGfm,
    [remarkFlexibleToc, { tocRef, maxDepth: 3 }],
];
/** Core rehype order. */
export const mdxRehypePlugins = (code) => [
    rehypeSlug,
    rehypeAutolinkHeadings,
    [rehypeKatex, { output: "htmlAndMathml", throwOnError: false }],
    [rehypeShikiDecorationRender, code ?? {}],
];
/** Core default components. */
export function defaultMdxComponents(options = {}) {
    const labels = { ...DEFAULT_LABELS, ...options.labels };
    const resolveHref = options.resolveHref;
    return {
        a: resolveHref
            ? (props) => _jsx(CmsLink, { ...props, href: resolveHref(props.href ?? "") })
            : CmsLink,
        pre: (props) => (_jsx(CmsPre, { ...props, copyLabel: labels.copyCode, copiedLabel: labels.copied, notesLabel: labels.codeNotes })),
        collapse: CmsCodeCollapse,
        fold: (props) => _jsx(CmsCodeFold, { ...props, label: labels.showFoldedCode }),
        // Translation note text is not shown on the public page (the pre-publish check blocks publishing while it remains).
        Untranslated: () => null,
        TextAlign: CmsTextAlign,
        Image: (props) => (_jsx(CmsImage, { ...props, resolve: options.imageResolver, unavailableLabel: labels.imageUnavailable })),
        File: (props) => (_jsx(CmsFile, { ...props, resolve: options.imageResolver, downloadLabel: labels.download, unavailableLabel: labels.fileUnavailable })),
        Table: CmsTable,
        TableRow: CmsTableRow,
        TableCell: CmsTableCell,
        // The first row header of a GFM table is a column header. For directive tables, TableCell tells row from column.
        th: ({ scope, ...props }) => _jsx("th", { ...props, scope: scope ?? "col" }),
    };
}
/** Function that loads a plugin's public components (`render` of `definePlugin`). */
const renderModules = () => {
    const plugins = cmsConfig.plugins ?? [];
    loaded ??= Promise.all(plugins.flatMap((plugin) => (plugin.render ? [plugin.render()] : [])));
    return loaded;
};
let loaded;
/** Component table merged in the order core defaults → block extensions → site. */
export async function mdxComponents(options = {}) {
    const context = { locale: options.locale, imageResolver: options.imageResolver };
    const fromPlugins = await Promise.all((await renderModules()).map((module) => module.default(context)));
    return Object.assign(defaultMdxComponents(options), ...fromPlugins, options.components);
}
/**
 * Renders published MDX. Bodies that fail the check (`analyze`) are not put into the executing compiler and an error is thrown (a body that
 * has passed the publish boundary is blocked again).
 */
export async function renderMdx(source, options = {}) {
    const errors = analyze(source).errors;
    if (errors.length > 0)
        throw new Error(`MDX validation failed: ${errors[0]?.message ?? "unknown"}`);
    const tocRef = [];
    const { content } = await compileMDX({
        source,
        options: {
            mdxOptions: {
                remarkPlugins: [...mdxRemarkPlugins(tocRef), ...(options.remarkPlugins ?? [])],
                rehypePlugins: [...mdxRehypePlugins(options.code), ...(options.rehypePlugins ?? [])],
            },
        },
        components: await mdxComponents(options),
    });
    return { content, toc: tocRef.map((item) => ({ ...item, depth: (item.depth - 2) })) };
}
/** Resolver that resolves registered media into public addresses for public MDX (server only). */
export { createPublicImageResolver } from "../mdx/public-image-resolver.js";
