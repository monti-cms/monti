import type { StoredDocument } from "../../doc/stored-document.js";
import type { CmsNode } from "../../doc/types.js";
import type { DocumentTocItem, TocRange } from "./types.js";
/**
 * The part of rendering that needs the whole document and no React: heading anchors, the table of contents and footnote numbers.
 * Anchors and footnotes follow what the MDX chain produced (`rehype-slug`, `remark-gfm`), so links into existing pages keep working.
 */
export declare const DEFAULT_TOC_RANGE: TocRange;
/** How a footnote label is compared: whitespace collapsed, trimmed, case folded (as micromark reads a label). */
export declare const footnoteIdentifier: (label: string) => string;
export interface FootnoteEntry {
    readonly identifier: string;
    /** The label as the definition wrote it. */
    readonly label: string;
    /** The footnote number, by first reference (1-based). */
    readonly index: number;
    readonly definition: CmsNode;
    /** The id of the footnote (`user-content-fn-1`). */
    readonly id: string;
    /** The ids of the references that point here, in order. */
    readonly refIds: string[];
}
export interface FootnoteRef {
    readonly entry: FootnoteEntry;
    /** Which reference of the footnote this is (1-based). */
    readonly count: number;
    readonly refId: string;
}
export interface Analysis {
    /** Heading node → its anchor (headings with a valid level only). */
    readonly slugs: ReadonlyMap<CmsNode, string>;
    /** Every heading in document order. */
    readonly headings: readonly (DocumentTocItem & {
        readonly node: CmsNode;
    })[];
    /** Reference node → its footnote. A reference without a definition is not in it. */
    readonly refs: ReadonlyMap<CmsNode, FootnoteRef>;
    /** The footnotes that are referenced, in order of first reference. */
    readonly footnotes: readonly FootnoteEntry[];
}
/** The level of a heading node (an integer from 1 to 6), or `undefined` for a malformed one. */
export declare const headingLevel: (node: CmsNode) => 1 | 2 | 3 | 4 | 5 | 6 | undefined;
export declare const analyzeDocument: (doc: StoredDocument) => Analysis;
/** The headings of the levels in `range`, with `depth` counted from the first level (`0` for an `h2` in the default range). */
export declare const tocOf: (analysis: Analysis, range?: TocRange) => DocumentTocItem[];
