import type { ReactNode } from "react";
import { type ReadRefs } from "../../doc/document-refs.js";
import { type StoredDocument } from "../../doc/stored-document.js";
import type { Site } from "../../site/index.js";
import type { DocumentTocItem, LooseDocumentComponents, RenderDocumentOptions, RenderedDocument, TocRange } from "./types.js";
/** Layers component tables: later ones win, and `marks`, `blocks` and `codeTags` merge by name. */
export declare const mergeDocumentComponents: (base: LooseDocumentComponents, ...layers: readonly (LooseDocumentComponents | undefined)[]) => LooseDocumentComponents;
/**
 * Renders a stored document. The result is `content` (a React tree) and `toc`, plus `unknown`: the nodes that reached the fallback (`renderMdx` of `@monti-cms/mdx/render` returns the same).
 * A value that is not a stored document of a known version renders as an empty body (and is logged), never as an error.
 */
export declare function renderDocument(input: StoredDocument, given: RenderDocumentOptions): Promise<RenderedDocument>;
/** What `CmsContent` reads from an entry of the read API (`ReadEntry`): the document, what it points to, and the language of the page. */
export interface CmsContentEntry {
    readonly doc: StoredDocument | null;
    readonly refs?: ReadRefs;
    readonly locale?: string;
}
/** The instance that renders: only its site is read (`cms.site`), so any object that has one will do. */
export interface CmsContentSource {
    readonly site: Site;
}
export type CmsContentProps = Omit<RenderDocumentOptions, "site"> & {
    /** The CMS instance the entry was read from (`cms`, or `{ site }`). Its site decides the blocks, code settings and plugin components used to render. */
    readonly cms: CmsContentSource;
} & ({
    /** An entry of the read API. Its `refs` draw the images and files, and its `locale` is the language of the page. */
    readonly entry: CmsContentEntry;
    readonly doc?: never;
} | {
    /** A stored document, for one that did not come from the read API. Pass `refs` or `imageResolver` to draw its images and files. */
    readonly doc: StoredDocument | null;
    readonly entry?: never;
});
/**
 * The body of an entry as a server component: `<CmsContent cms={cms} entry={entry} />` (the document, its media from `entry.refs`, the language from
 * `entry.locale`, the blocks and code settings of `cms.site`), or `<CmsContent cms={cms} doc={doc} />` for a document on its own. The rest are the options of `renderDocument`, which win over the entry's.
 * An entry without a document renders nothing. The table of contents is not available here; call `renderDocument` or `tableOfContents` for it.
 */
export declare function CmsContent({ cms, entry, doc, ...options }: CmsContentProps): Promise<ReactNode>;
/**
 * The headings of a document with their anchors (pure, no React). `range` is the levels to list; the default is `h2` and `h3`.
 * A missing document (`entry.doc` of a list read without a body) has none.
 */
export declare function tableOfContents(doc: StoredDocument | null | undefined, range?: TocRange): DocumentTocItem[];
export { collectRefs, type DocumentRefIds, imageResolverFromRefs, type ReadRefs } from "../../doc/document-refs.js";
export { readCodeBlock } from "./code.js";
export type { BlockItem, BlockProps, BlockquoteProps, CodeBlockProps, CommonProps, CoreDocumentComponents, CoreMarkComponents, DocumentComponents, DocumentComponentsContext, DocumentComponentsFor, DocumentComponentsOf, DocumentTocItem, FileProps, FootnoteItem, FootnoteRefProps, FootnotesProps, HardBreakProps, HeadingProps, HorizontalRuleProps, ImageProps, LinkProps, ListItemProps, ListProps, LooseDocumentComponents, MarkBlockProps, MarkProps, MathProps, ParagraphProps, RenderContext, RenderDocumentOptions, RenderedDocument, SiteBlockComponents, SiteMarkComponents, StoredCodeAnnotations, StoredNode, StoredNodeOf, TableCellProps, TableProps, TableRowProps, TextAlignProps, TocRange, UnknownProps, } from "./types.js";
