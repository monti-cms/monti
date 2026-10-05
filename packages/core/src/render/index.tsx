/**
 * Body rendering (`@monti-cms/core/render`). Renders published MDX with React. The core decides the remark and rehype order (same syntax as the editor), and
 * components are overridden in this order: core defaults (link, image, file, table, alignment, code lines) → public components of block extensions (plugin `render`) → the ones the site passes.
 * Call it from a server component.
 */
import type { Element } from "hast";
import type { Root, Text } from "mdast";
import { compileMDX } from "next-mdx-remote/rsc";
import type { ComponentProps, ComponentType, ReactNode } from "react";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkFlexibleToc, { type TocItem } from "remark-flexible-toc";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { PluggableList } from "unified";
import { visit } from "unist-util-visit";
import { annotationConfig } from "../annotation/code-block/active";
import { cmsConfig } from "../config/resolved";
import { analyze } from "../mdx/analyze";
import type { ImageResolver } from "../mdx/image-src";
import { remarkBreakNewline } from "../mdx/remark-break-newline";
import { remarkFenceBlocksToMdx } from "../mdx/remark-fence-blocks";
import { configuredSyntax, syntaxRemarkPlugins } from "../mdx/syntax";
import type { CmsPlugin } from "../plugin/define";
import type { SyntaxExtension } from "../syntax/types";
import { type CodeHighlightOptions, rehypeShikiDecorationRender, remarkAnnotationToShikiDecoration } from "./code";
import { CmsCodeCollapse, CmsCodeFold } from "./components/code-lines";
import { CmsFile } from "./components/file";
import { CmsImage } from "./components/image";
import { CmsLink } from "./components/link";
import { CmsPre } from "./components/pre";
import { CmsTable, CmsTableCell, CmsTableRow } from "./components/table";
import { CmsTextAlign } from "./components/text-align";

// biome-ignore lint/suspicious/noExplicitAny: the MDX component table has different props per element
export type MdxComponents = Record<string, ComponentType<any>>;

/** Fixed texts of the core default components. Passed in the site language. */
export interface RenderLabels {
	readonly imageUnavailable: string;
	readonly fileUnavailable: string;
	readonly download: string;
	readonly showFoldedCode: string;
	readonly copyCode: string;
	readonly copied: string;
	readonly codeNotes: string;
}

const DEFAULT_LABELS: RenderLabels = {
	imageUnavailable: "Image unavailable",
	fileUnavailable: "File unavailable",
	download: "Download",
	showFoldedCode: "Show folded code",
	copyCode: "Copy",
	copied: "Copied",
	codeNotes: "Code notes",
};

export interface RenderMdxOptions {
	/** Resolver for body image and file addresses (`createPublicImageResolver(mdx)`). Only the outer `src` if absent. */
	readonly imageResolver?: ImageResolver;
	/** Language of the public page. Block public components receive it. */
	readonly locale?: string;
	/** Rewrites in-site links in the body (e.g. to the same-language translation address). */
	readonly resolveHref?: (href: string) => string;
	/** Components to override (name → component). The block name is the block definition's `component`. */
	readonly components?: MdxComponents;
	readonly labels?: Partial<RenderLabels>;
	/** Code highlighting (languages and themes). */
	readonly code?: CodeHighlightOptions;
	/** remark and rehype plugins to add after the core plugins. */
	readonly remarkPlugins?: PluggableList;
	readonly rehypePlugins?: PluggableList;
	/** Syntax extensions to read the body with. Default: the site's `mdx.syntax`. */
	readonly syntax?: readonly SyntaxExtension[];
}

/** Public components given by block extensions (plugin `render`). They receive the site language and the resolver. */
export interface PluginRenderContext {
	readonly locale?: string;
	readonly imageResolver?: ImageResolver;
}

/** A single `$` in the body is not treated as math (same as the editor parser). `$…$` is turned back into text. */
const remarkDisableInlineMath = () => (tree: Root) => {
	visit(tree, "inlineMath", (node, index, parent) => {
		if (index == null || !parent) return;
		parent.children.splice(index, 1, { type: "text", value: `$${node.value}$` } satisfies Text);
	});
};

/** Core remark order. The editor and the review runner use the same setup. */
export const mdxRemarkPlugins = (
	tocRef: TocItem[] = [],
	syntax: readonly SyntaxExtension[] = configuredSyntax(),
): PluggableList => [
	[remarkAnnotationToShikiDecoration, annotationConfig],
	[remarkMath, { singleDollarTextMath: false }],
	remarkDisableInlineMath,
	// Notations of the site's syntax extensions (`mdx.syntax`, for example directives) become MDX elements, as in the editor's parser.
	...syntaxRemarkPlugins(syntax),
	// Code fence blocks (charts, diagrams etc.) are turned into `<block source="…"/>`.
	remarkFenceBlocksToMdx,
	// A single newline inside a paragraph is a space, as in CommonMark and in the CMS tree; a break is written `<br />`. The line ending the serializer writes
	// after `<br />` is not content, so it is dropped here as the parser drops it: the page then renders the same text the tree holds (no stray newline after `<br>`).
	remarkBreakNewline,
	remarkGfm,
	[remarkFlexibleToc, { tocRef, maxDepth: 3 }],
];

/** Core rehype order. */
export const mdxRehypePlugins = (code?: CodeHighlightOptions): PluggableList => [
	rehypeSlug,
	// The hidden heading of the footnote section (`#footnote-label`) is referenced by the footnote links, so it gets no anchor of its own.
	[rehypeAutolinkHeadings, { test: (node: Element) => node.properties?.id !== "footnote-label" }],
	[rehypeKatex, { output: "htmlAndMathml", throwOnError: false }],
	[rehypeShikiDecorationRender, code ?? {}],
];

/** Core default components. */
export function defaultMdxComponents(options: RenderMdxOptions = {}): MdxComponents {
	const labels = { ...DEFAULT_LABELS, ...options.labels };
	const resolveHref = options.resolveHref;
	return {
		a: resolveHref
			? (props: ComponentProps<typeof CmsLink>) => <CmsLink {...props} href={resolveHref(props.href ?? "")} />
			: CmsLink,
		pre: (props: ComponentProps<typeof CmsPre>) => (
			<CmsPre {...props} copyLabel={labels.copyCode} copiedLabel={labels.copied} notesLabel={labels.codeNotes} />
		),
		collapse: CmsCodeCollapse,
		fold: (props: ComponentProps<typeof CmsCodeFold>) => <CmsCodeFold {...props} label={labels.showFoldedCode} />,
		// Translation note text is not shown on the public page (the pre-publish check blocks publishing while it remains).
		Untranslated: () => null,
		TextAlign: CmsTextAlign,
		Image: (props: ComponentProps<typeof CmsImage>) => (
			<CmsImage {...props} resolve={options.imageResolver} unavailableLabel={labels.imageUnavailable} />
		),
		File: (props: ComponentProps<typeof CmsFile>) => (
			<CmsFile
				{...props}
				resolve={options.imageResolver}
				downloadLabel={labels.download}
				unavailableLabel={labels.fileUnavailable}
			/>
		),
		Table: CmsTable,
		TableRow: CmsTableRow,
		TableCell: CmsTableCell,
		// The first row header of a GFM table is a column header. For directive tables, TableCell tells row from column.
		th: ({ scope, ...props }: ComponentProps<"th">) => <th {...props} scope={scope ?? "col"} />,
	};
}

type RenderPluginModule = {
	readonly default: (context: PluginRenderContext) => MdxComponents | Promise<MdxComponents>;
};

/** Function that loads a plugin's public components (`render` of `definePlugin`). */
const renderModules = (): Promise<RenderPluginModule[]> => {
	const plugins: readonly CmsPlugin[] = cmsConfig.plugins ?? [];
	loaded ??= Promise.all(
		plugins.flatMap((plugin) => (plugin.render ? [plugin.render() as Promise<RenderPluginModule>] : [])),
	);
	return loaded;
};
let loaded: Promise<RenderPluginModule[]> | undefined;

/** Component table merged in the order core defaults → block extensions → site. */
export async function mdxComponents(options: RenderMdxOptions = {}): Promise<MdxComponents> {
	const context: PluginRenderContext = { locale: options.locale, imageResolver: options.imageResolver };
	const fromPlugins = await Promise.all((await renderModules()).map((module) => module.default(context)));
	return Object.assign(defaultMdxComponents(options), ...fromPlugins, options.components);
}

export interface RenderedMdx {
	readonly content: ReactNode;
	/** Heading table of contents (depth 1 from h2). */
	readonly toc: readonly TocItem[];
}

/**
 * Renders published MDX. Bodies that fail the check (`analyze`) are not put into the executing compiler and an error is thrown (a body that
 * has passed the publish boundary is blocked again).
 */
export async function renderMdx(source: string, options: RenderMdxOptions = {}): Promise<RenderedMdx> {
	const errors = analyze(source, undefined, options.syntax).errors;
	if (errors.length > 0) throw new Error(`MDX validation failed: ${errors[0]?.message ?? "unknown"}`);
	const tocRef: TocItem[] = [];
	const { content } = await compileMDX({
		source,
		options: {
			mdxOptions: {
				remarkPlugins: [...mdxRemarkPlugins(tocRef, options.syntax), ...(options.remarkPlugins ?? [])],
				rehypePlugins: [...mdxRehypePlugins(options.code), ...(options.rehypePlugins ?? [])],
			},
		},
		components: await mdxComponents(options),
	});
	return { content, toc: tocRef.map((item) => ({ ...item, depth: (item.depth - 2) as TocItem["depth"] })) };
}

export type { TocItem } from "remark-flexible-toc";

/** Resolver that resolves registered media into public addresses for public MDX (server only). */
export { createPublicImageResolver } from "../mdx/public-image-resolver";
