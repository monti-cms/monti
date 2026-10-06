import katex from "katex";
import type { ReactNode } from "react";
import { fenceBlockOf } from "../../blocks/derive";
import { readStoredDocument, type StoredDocument } from "../../mdx/stored-document";
import type { CmsNode } from "../../mdx/types";
import { DEFAULT_LABELS } from "../labels";
import { renderModules } from "../plugin-render";
import { analyzeDocument, DEFAULT_TOC_RANGE, tocOf } from "./analyze";
import { type HighlightedCode, highlightCodeBlock, highlighterFor, readCodeBlock } from "./code";
import { defaultDocumentComponents } from "./defaults";
import { type ResolvedComponents, renderDocumentTree } from "./render";
import type {
	DocumentComponentsContext,
	DocumentTocItem,
	LooseDocumentComponents,
	RenderDocumentOptions,
	RenderedDocument,
	TocRange,
} from "./types";

/**
 * JSON renderer (`renderDocument`, `CmsContent`, `tableOfContents`): renders a stored document with React, with no MDX compile and no code execution.
 *
 * Two phases. First an async pre-pass reads the whole document once: heading anchors and the table of contents, footnote numbers, Shiki highlighting of
 * every code block and KaTeX output of every formula. Then a synchronous, pure render turns nodes into elements, so the result is a plain React tree that
 * works in server components and in `renderToStaticMarkup` tests.
 *
 * It never throws on content. An unknown node, mark or block, a block without a component and a node with malformed attributes go through the
 * `fallback` component and are listed in `unknown` (`strict: true` throws instead, for tests and the preview page). Components are layered core defaults →
 * block extensions (`documentComponents` of a plugin's render module) → the site's `components`.
 */

const LAYERED = ["marks", "blocks", "codeTags"] as const;

/** Layers component tables: later ones win, and `marks`, `blocks` and `codeTags` merge by name. */
export const mergeDocumentComponents = (
	base: LooseDocumentComponents,
	...layers: readonly (LooseDocumentComponents | undefined)[]
): LooseDocumentComponents => {
	const out: Record<string, unknown> = { ...base };
	for (const layer of layers) {
		if (!layer) continue;
		for (const [key, value] of Object.entries(layer)) {
			if (value === undefined) continue;
			out[key] = (LAYERED as readonly string[]).includes(key)
				? { ...(out[key] as object | undefined), ...value }
				: value;
		}
	}
	return out as LooseDocumentComponents;
};

const resolveComponents = async (
	options: RenderDocumentOptions,
	showFoldedCode: string,
): Promise<ResolvedComponents> => {
	const context: DocumentComponentsContext = { locale: options.locale, imageResolver: options.imageResolver };
	const fromPlugins = await Promise.all(
		(await renderModules()).map(async (module) =>
			typeof module.documentComponents === "function"
				? ((await module.documentComponents(context)) as LooseDocumentComponents)
				: undefined,
		),
	);
	return mergeDocumentComponents(
		defaultDocumentComponents(showFoldedCode),
		...fromPlugins,
		options.components as LooseDocumentComponents | undefined,
	) as ResolvedComponents;
};

const escapeHtml = (value: string) =>
	value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** KaTeX output for a block formula (`htmlAndMathml`). A formula KaTeX cannot read still renders (as `rehype-katex` did) and never throws. */
const renderMath = (value: string): string => {
	const settings = { displayMode: true, output: "htmlAndMathml" as const };
	try {
		return katex.renderToString(value, { ...settings, throwOnError: true });
	} catch (error) {
		if (error instanceof Error && error.name === "ParseError") {
			return katex.renderToString(value, { ...settings, strict: "ignore", throwOnError: false });
		}
		return `<span class="katex-error" style="color:#cc0000" title="${escapeHtml(String(error))}">${escapeHtml(value)}</span>`;
	}
};

const collect = (nodes: readonly CmsNode[], into: { code: CmsNode[]; math: CmsNode[] }) => {
	for (const node of nodes) {
		if (node.type === "codeBlock") {
			// A code fence of a block (`mermaid`, `chart`) goes to that block's component, not to the highlighter.
			if (!fenceBlockOf(readCodeBlock(node).language)) into.code.push(node);
		} else if (node.type === "math") into.math.push(node);
		if (node.content) collect(node.content, into);
	}
};

const EMPTY: RenderedDocument = { content: null, toc: [], unknown: [] };

/**
 * Renders a stored document. The same result shape as `renderMdx`: `content` (a React tree) and `toc`, plus `unknown`: the nodes that reached the fallback.
 * A value that is not a stored document of a known version renders as an empty body (and is logged), never as an error.
 */
export async function renderDocument(
	input: StoredDocument,
	options: RenderDocumentOptions = {},
): Promise<RenderedDocument> {
	const doc = readStoredDocument(input);
	if (!doc) {
		console.error("renderDocument: the value is not a stored document of a known version; rendering an empty body");
		return EMPTY;
	}
	const labels = { ...DEFAULT_LABELS, ...options.labels };
	const components = await resolveComponents(options, labels.showFoldedCode);
	const analysis = analyzeDocument(doc);

	// Pre-pass: highlight every code block and render every formula, once.
	const found = { code: [] as CmsNode[], math: [] as CmsNode[] };
	collect(doc.content, found);
	const highlighted = new Map<CmsNode, HighlightedCode>();
	if (found.code.length > 0) {
		const highlight = await highlighterFor(options.code);
		await Promise.all(
			found.code.map(async (node) => {
				highlighted.set(node, highlightCodeBlock(node, highlight, options.code));
			}),
		);
	}
	const math = new Map<CmsNode, string>(found.math.map((node) => [node, renderMath(String(node.attrs?.value ?? ""))]));

	const { content, unknown } = renderDocumentTree(doc.content, {
		analysis,
		highlighted,
		math,
		components,
		ctx: { locale: options.locale, labels },
		options,
	});
	return { content, toc: tocOf(analysis), unknown };
}

/**
 * The body of an entry as a server component: `<CmsContent doc={entry.doc} locale={locale} />`. Takes the options of `renderDocument`.
 * The table of contents is not available here; call `renderDocument` or `tableOfContents` for it.
 */
export async function CmsContent({
	doc,
	...options
}: { readonly doc: StoredDocument } & RenderDocumentOptions): Promise<ReactNode> {
	return (await renderDocument(doc, options)).content;
}

/** The headings of a document with their anchors (pure, no React). `range` is the levels to list; the default is `h2` and `h3`. */
export function tableOfContents(doc: StoredDocument, range: TocRange = DEFAULT_TOC_RANGE): DocumentTocItem[] {
	const stored = readStoredDocument(doc);
	return stored ? tocOf(analyzeDocument(stored), range) : [];
}

export { readCodeBlock } from "./code";
export type {
	BlockItem,
	BlockProps,
	BlockquoteProps,
	CodeBlockProps,
	CommonProps,
	CoreDocumentComponents,
	CoreMarkComponents,
	DocumentComponents,
	DocumentComponentsContext,
	DocumentComponentsFor,
	DocumentTocItem,
	FileProps,
	FootnoteItem,
	FootnoteRefProps,
	FootnotesProps,
	HardBreakProps,
	HeadingProps,
	HorizontalRuleProps,
	ImageProps,
	LinkProps,
	ListItemProps,
	ListProps,
	LooseDocumentComponents,
	MarkBlockProps,
	MarkProps,
	MathProps,
	ParagraphProps,
	RenderContext,
	RenderDocumentOptions,
	RenderedDocument,
	SiteBlockComponents,
	SiteMarkComponents,
	StoredCodeAnnotations,
	StoredNode,
	StoredNodeOf,
	TableCellProps,
	TableProps,
	TableRowProps,
	TextAlignProps,
	TocRange,
	UnknownProps,
} from "./types";
