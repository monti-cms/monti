import type { ComponentType, ReactNode } from "react";
import type { BlockDefinition } from "../../blocks/define";
import type { ReadLink, ReadRefs } from "../../doc/document-refs";
import type { ImageResolveFailure, ImageResolver } from "../../doc/image-src";
import type { CmsJsonValue, CmsNode } from "../../doc/types";
import type { Site } from "../../site";
import type { CodeHighlightOptions } from "../code";
import type { RenderLabels } from "../labels";
import type { AttributeProps, SiteBlockDefinitions } from "./block-types";

/**
 * Types of the JSON renderer (`renderDocument`, `CmsContent`): one props type per node, mark and block, and the component table a site passes.
 *
 * A component receives plain values it can render without knowing the document model (`level`, `id`, `href`, flat block attributes), plus `node`
 * (the stored node, for what the props do not say), `blockId` (the node's `id`, usable as an anchor) and `ctx`. `ctx` is plain JSON, so it
 * can be passed on to a client component.
 */

/** A node of a stored document (`StoredDocument.content`). */
export type StoredNode = CmsNode;

/** A stored node of one type. */
export type StoredNodeOf<Type extends string> = CmsNode & { readonly type: Type };

export interface RenderContext {
	/** Language of the public page. */
	readonly locale?: string;
	/** Fixed texts of the default components, in the site language. */
	readonly labels: RenderLabels;
}

/** What every block-level component receives. */
export interface CommonProps<Node extends StoredNode = StoredNode> {
	/** The node's block id (`StoredNode.id`). */
	readonly blockId?: string;
	readonly node: Node;
	readonly ctx: RenderContext;
}

// ---- core nodes -----------------------------------------------------------------------------------------------------------------

export interface ParagraphProps extends CommonProps<StoredNodeOf<"paragraph">> {
	readonly children: ReactNode;
}

export interface HeadingProps extends CommonProps<StoredNodeOf<"heading">> {
	readonly level: 1 | 2 | 3 | 4 | 5 | 6;
	/** The anchor (`github-slugger` over the heading text; a repeat gets `-1`, `-2`, ...). The same value as in the table of contents. */
	readonly id: string;
	readonly children: ReactNode;
}

export interface ListProps extends CommonProps<StoredNodeOf<"bulletList" | "orderedList">> {
	readonly ordered: boolean;
	/** First number of an ordered list that does not start at 1. */
	readonly start?: number;
	/** Whether the items keep their paragraphs. A list is loose when any item holds more than one block. */
	readonly loose: boolean;
	/** Whether the items are task list items (`- [ ] a`). */
	readonly tasks: boolean;
	readonly children: ReactNode;
}

export interface ListItemProps extends CommonProps<StoredNodeOf<"listItem">> {
	/** The state of a task list item (`- [x] a`); absent for an ordinary item. The checkbox itself is already in `children`. */
	readonly checked?: boolean;
	readonly children: ReactNode;
}

export interface BlockquoteProps extends CommonProps<StoredNodeOf<"blockquote">> {
	readonly children: ReactNode;
}

export type HorizontalRuleProps = CommonProps<StoredNodeOf<"horizontalRule">>;

export type HardBreakProps = CommonProps<StoredNodeOf<"hardBreak">>;

/** The code annotations of a stored code block: line effects, text effects and regex rules, as stored. */
export interface StoredCodeAnnotations {
	readonly lines?: readonly {
		readonly name: string;
		readonly start: number;
		readonly end: number;
		readonly attrs?: Record<string, CmsJsonValue>;
	}[];
	readonly text?: readonly {
		readonly line: number;
		readonly scope: string;
		readonly name: string;
		readonly start: number;
		readonly end: number;
		readonly attrs?: Record<string, CmsJsonValue>;
	}[];
	readonly rules?: readonly {
		readonly scope: string;
		readonly name: string;
		readonly pattern: string;
		readonly flags: string;
		readonly line?: number;
		readonly attrs?: Record<string, CmsJsonValue>;
	}[];
}

export interface CodeBlockProps extends CommonProps<StoredNodeOf<"codeBlock">> {
	readonly language: string;
	readonly code: string;
	/** The file name (`title="src/a.ts"` in the fence meta). */
	readonly title?: string;
	readonly showLineNumbers: boolean;
	/** The descriptions of the tooltips inside the code, in number order. */
	readonly notes: readonly string[];
	/** The annotations as stored, for a site that brings its own highlighter. */
	readonly annotations: StoredCodeAnnotations;
	/** The highlighted `<pre>` (Shiki classes, one `.line` per line with `data-line`, `data-anchor` and effect classes). */
	readonly children: ReactNode;
}

export interface ImageProps extends CommonProps<StoredNodeOf<"image">> {
	/** The address to load: resolved by the image resolver, or the outer `src` when it is an allowed address. Absent when `failure` is set. */
	readonly src?: string;
	readonly alt: string;
	readonly title?: string;
	readonly caption?: string;
	readonly decorative: boolean;
	readonly align: "left" | "center" | "right";
	/** A width that passed the check (1 to 100% or 1 to 4096px). */
	readonly width?: string;
	readonly crop?: string;
	readonly rotate?: 0 | 90 | 180 | 270;
	/** The original size of the registered media, to reserve the space before it loads. */
	readonly intrinsic?: { readonly width: number; readonly height: number };
	/** Why `src` is missing. */
	readonly failure?: ImageResolveFailure;
	/** Inside a paragraph, next to text (not a block of its own). */
	readonly inline: boolean;
	/** A Markdown image (`![alt](src)`): nothing but `src`, `alt` and `title`. The default component draws it as a plain `<img>`. */
	readonly plain: boolean;
}

export interface FileProps extends CommonProps<StoredNodeOf<"file">> {
	readonly mediaId?: string;
	/** The name shown on the card (the label, else the file name). */
	readonly label: string;
	readonly url?: string;
	readonly filename?: string;
	readonly byteSize?: number | null;
	readonly mimeType?: string | null;
	readonly failure?: ImageResolveFailure;
}

export interface TextAlignProps extends CommonProps<StoredNodeOf<"text-align">> {
	/** Only a checked value: `left`, `center` or `right`. */
	readonly align?: "left" | "center" | "right";
	readonly children: ReactNode;
}

export interface TableProps extends CommonProps<StoredNodeOf<"table">> {
	/** The number of grid columns. */
	readonly columns: number;
	/** The width (px) of each column; `null` for an automatic one. Empty when no width is set. */
	readonly widths: readonly (number | null)[];
	/** Whether the first row is a header row that goes in `<thead>`. */
	readonly hasHead: boolean;
	/** The header row (when `hasHead`). */
	readonly head: ReactNode;
	/** The rows that are not in `head`. */
	readonly body: ReactNode;
	/** All rows. */
	readonly children: ReactNode;
}

export interface TableRowProps extends CommonProps<StoredNodeOf<"tableRow">> {
	readonly inHead: boolean;
	readonly children: ReactNode;
}

export interface TableCellProps extends CommonProps<StoredNodeOf<"tableCell">> {
	readonly as: "th" | "td";
	readonly scope?: "col" | "row";
	readonly colSpan: number;
	readonly rowSpan: number;
	readonly align?: "left" | "center" | "right";
	readonly firstColumn: boolean;
	readonly lastColumn: boolean;
	readonly inHead: boolean;
	readonly children: ReactNode;
}

export interface MathProps extends CommonProps<StoredNodeOf<"math">> {
	/** The formula (TeX). */
	readonly value: string;
	/** KaTeX output (`htmlAndMathml`). The only HTML the renderer hands out; draw it with `dangerouslySetInnerHTML`. */
	readonly html: string;
}

export interface FootnoteRefProps {
	readonly label: string;
	/** The footnote number (by first reference). */
	readonly index: number;
	/** The id of this reference (`user-content-fnref-1`, `user-content-fnref-1-2` for a second one). */
	readonly refId: string;
	/** The id of the footnote (`user-content-fn-1`). */
	readonly targetId: string;
	readonly ctx: RenderContext;
}

export interface FootnoteItem {
	readonly id: string;
	readonly label: string;
	readonly index: number;
	/** The ids of the references that point here. */
	readonly backRefIds: readonly string[];
	/** The definition's blocks, with the links back to the references already added. */
	readonly children: ReactNode;
}

export interface FootnotesProps {
	readonly items: readonly FootnoteItem[];
	readonly ctx: RenderContext;
}

// ---- marks ------------------------------------------------------------------------------------------------------------------------

export interface LinkProps {
	/** The address, after `resolveHref`. Absent when the mark carries none. */
	readonly href?: string;
	readonly title?: string;
	/** Whether the address is an `http(s)` URL. */
	readonly external: boolean;
	/** The entry an internal link points to (its translation group id). Such a link has no `href` of its own: it is the address of `entry`. */
	readonly entryId?: string;
	/** Where an internal link goes for this reader. Absent when the target is not published or is gone (then there is no `href` either). */
	readonly entry?: ReadLink;
	readonly children: ReactNode;
	readonly ctx: RenderContext;
}

export interface MarkProps {
	readonly children: ReactNode;
	readonly ctx: RenderContext;
}

export type CoreMarkName =
	| "bold"
	| "italic"
	| "strike"
	| "underline"
	| "superscript"
	| "subscript"
	| "code"
	| "untranslated"
	| "link";

export interface CoreMarkComponents {
	readonly link?: ComponentType<LinkProps>;
	readonly bold?: ComponentType<MarkProps>;
	readonly italic?: ComponentType<MarkProps>;
	readonly strike?: ComponentType<MarkProps>;
	readonly underline?: ComponentType<MarkProps>;
	readonly superscript?: ComponentType<MarkProps>;
	readonly subscript?: ComponentType<MarkProps>;
	readonly code?: ComponentType<MarkProps>;
	readonly untranslated?: ComponentType<MarkProps>;
}

// ---- blocks from definitions -------------------------------------------------------------------------------------------------------

/** One child of a block: its node, the element it renders to, and what it renders its own children to. */
export interface BlockItem {
	readonly node: StoredNode;
	readonly element: ReactNode;
	/** The rendered content of the child (without the child's own component), e.g. the body of one tab. */
	readonly children: ReactNode;
}

/** The props of the component of a block (container, leaf or code fence): its attributes, flat, and what the renderer adds. */
export type BlockProps<D extends BlockDefinition> = AttributeProps<D> &
	CommonProps<StoredNode> & {
		/** The rendered content (container blocks). */
		readonly children: ReactNode;
		/** The children with their stored nodes, for a block that reads its children (tabs, columns, a code explorer). */
		readonly items: readonly BlockItem[];
	} & (D["syntax"]["kind"] extends "fence" ? { readonly source: string } : unknown);

/** The props of the component of a text mark block (`tooltip`, `code-ref`, `color`): its attributes and the text. */
export type MarkBlockProps<D extends BlockDefinition> = AttributeProps<D> & {
	readonly children: ReactNode;
	readonly ctx: RenderContext;
};

type TextDefinition = { readonly syntax: { readonly kind: "text" } };

/** Components of the blocks a site config holds (its `blocks` and its plugins' `blocks`), by block name. */
export type SiteBlockComponents<Config> = {
	readonly [D in Exclude<SiteBlockDefinitions<Config>, TextDefinition> as D["name"]]?: ComponentType<BlockProps<D>>;
};

/** Components of the text marks a site config holds, by block name. */
export type SiteMarkComponents<Config> = {
	readonly [D in Extract<SiteBlockDefinitions<Config>, TextDefinition> as D["name"]]?: ComponentType<MarkBlockProps<D>>;
};

// ---- unknown content --------------------------------------------------------------------------------------------------------------

export interface UnknownProps {
	readonly node: StoredNode;
	readonly kind: "block" | "inline" | "mark";
	/** Why the node got here. */
	readonly reason: "unknown-node" | "unknown-block" | "unknown-mark" | "no-component" | "malformed";
	/** What the node's children rendered to (an unknown container shows its content). */
	readonly children?: ReactNode;
	readonly ctx: RenderContext;
}

// ---- the component table ----------------------------------------------------------------------------------------------------------

/** The components of the core nodes. */
export interface CoreDocumentComponents {
	readonly paragraph?: ComponentType<ParagraphProps>;
	readonly heading?: ComponentType<HeadingProps>;
	readonly list?: ComponentType<ListProps>;
	readonly listItem?: ComponentType<ListItemProps>;
	readonly blockquote?: ComponentType<BlockquoteProps>;
	readonly horizontalRule?: ComponentType<HorizontalRuleProps>;
	readonly hardBreak?: ComponentType<HardBreakProps>;
	readonly codeBlock?: ComponentType<CodeBlockProps>;
	readonly image?: ComponentType<ImageProps>;
	readonly file?: ComponentType<FileProps>;
	readonly textAlign?: ComponentType<TextAlignProps>;
	readonly table?: ComponentType<TableProps>;
	readonly tableRow?: ComponentType<TableRowProps>;
	readonly tableCell?: ComponentType<TableCellProps>;
	readonly math?: ComponentType<MathProps>;
	readonly footnoteRef?: ComponentType<FootnoteRefProps>;
	readonly footnotes?: ComponentType<FootnotesProps>;
	/** Elements inside code blocks that a text effect or a line effect draws with a component (`fold`, `collapse`, `Tooltip`, `strong`, `em`, `del`, `u`). */
	readonly codeTags?: Readonly<Record<string, ComponentType<{ readonly children?: ReactNode }>>>;
	/** What an unknown node, an unknown mark, a block without a component or a node with malformed attributes renders to. */
	readonly fallback?: ComponentType<UnknownProps>;
}

/**
 * The component table for a site config: the core components, `marks` (core marks plus the text blocks of the config) and `blocks` (the container, leaf
 * and fence blocks of the config). The block names and the props of each come from the definitions in the site's config (`defineBlock`).
 */
export interface DocumentComponentsFor<Config> extends CoreDocumentComponents {
	readonly marks?: CoreMarkComponents & SiteMarkComponents<Config>;
	readonly blocks?: SiteBlockComponents<Config>;
}

/**
 * The component table of the site an instance serves: `DocumentComponentsOf<typeof cms>`. The block names and the props of each come from the config's type
 * (the same as `DocumentComponentsFor<typeof config>`), so a site's components are checked against the blocks it defines.
 */
export type DocumentComponentsOf<Cms extends { readonly site: { readonly config: unknown } }> = DocumentComponentsFor<
	Cms["site"]["config"]
>;

/** The component table of any site: `blocks` and `marks` by name with untyped props. Use `DocumentComponentsOf` or `DocumentComponentsFor` for a typed one. */
export type DocumentComponents = LooseDocumentComponents;

/** A component table with untyped `blocks` and `marks`: what a block extension returns and what the renderer merges. */
export interface LooseDocumentComponents extends CoreDocumentComponents {
	// biome-ignore lint/suspicious/noExplicitAny: block and mark props differ per definition
	readonly marks?: Readonly<Record<string, ComponentType<any>>>;
	// biome-ignore lint/suspicious/noExplicitAny: block and mark props differ per definition
	readonly blocks?: Readonly<Record<string, ComponentType<any>>>;
}

/** What a block extension's render module gets (`documentComponents(context)`). */
export interface DocumentComponentsContext {
	readonly locale?: string;
	readonly imageResolver?: ImageResolver;
}

export interface RenderDocumentOptions {
	/**
	 * The site the document is rendered for (`cms.site`): its blocks decide which blocks, marks and code fences there are, its code settings the line effects and the
	 * themes, its plugins the components they add. `<CmsContent cms={cms} />` passes it for you.
	 */
	readonly site: Site;
	/**
	 * What the document points to, resolved: `entry.refs` of a read. Images and files are drawn from it (a registered media id that is not in it is
	 * unresolved). `<CmsContent entry={entry} />` passes it for you.
	 */
	readonly refs?: ReadRefs;
	/**
	 * Resolver for image and file addresses, for a site that resolves them itself. Wins over `refs`. Without both, only the outer `src` is used.
	 * (To draw a document read from the API, pass its `entry.refs` instead.)
	 */
	readonly imageResolver?: ImageResolver;
	/** Language of the public page. Block components receive it as `ctx.locale`. */
	readonly locale?: string;
	/** Rewrites in-site links (e.g. to the same-language translation address). */
	readonly resolveHref?: (href: string) => string;
	/** Components to override. Applied on top of the core defaults and the block extensions' components. */
	readonly components?: DocumentComponents;
	readonly labels?: Partial<RenderLabels>;
	/** Code highlighting (languages and themes). */
	readonly code?: CodeHighlightOptions;
	/** Called for every node that reached the fallback (once per node). */
	readonly onUnknown?: (node: StoredNode) => void;
	/** Throw on the first unknown node instead of rendering the fallback (for tests and the preview page). */
	readonly strict?: boolean;
}

/** One heading of the table of contents. */
export interface DocumentTocItem {
	/** The heading text. */
	readonly value: string;
	/** The anchor, with the `#` (`#intro`). */
	readonly href: string;
	/** The anchor without the `#`: the `id` of the heading. */
	readonly id: string;
	/** The heading level (1 to 6). */
	readonly level: number;
	/** The level counted from the first level of the range: `0` for an `h2` in the default range. */
	readonly depth: number;
}

export interface RenderedDocument {
	readonly content: ReactNode;
	/** The headings of levels 2 and 3 (`tableOfContents` with the default range). */
	readonly toc: readonly DocumentTocItem[];
	/** The nodes that reached the fallback, in document order. */
	readonly unknown: readonly StoredNode[];
}

/** Levels of the headings the table of contents lists. */
export interface TocRange {
	readonly min: number;
	readonly max: number;
}
