import { PLACEHOLDER, type TextCheckSegment } from "@monti-cms/core/client";
import type { Node as PmNode } from "@tiptap/pm/model";
export { PLACEHOLDER };
/**
 * Editor document -> check segments (paragraphs) extraction. Each block that contains text (paragraph, heading, list item, table cell, callout body, etc.) is one segment.
 *
 * What is not sent:
 * - Code blocks, non-text blocks such as math, code fence, and raw-preservation boxes (nodes selected as a whole), and block attributes
 * - Inline code and URLs (links whose text is the URL itself, and URLs written as is in the body). These spots are replaced with a single `PLACEHOLDER` character
 *   so the positions of surrounding text map back to document positions as is.
 * - Inline nodes such as images are also a single `PLACEHOLDER` character. A line break is `\n`.
 * For links, only the text is sent, not the URL (attribute).
 */
/** A check segment that knows its document positions. */
export interface DocSegment extends TextCheckSegment {
    /** Document range of the block content. */
    readonly from: number;
    readonly to: number;
    /** Document range occupied by character `i` (`starts[i]` ~ `ends[i]`). A placeholder character covers the whole hidden range. */
    readonly starts: readonly number[];
    readonly ends: readonly number[];
}
export interface ExtractOptions {
    readonly locale: string;
    /** Returns only blocks overlapping this range (selection check). Names (`id`) are assigned based on the whole document. */
    readonly range?: {
        readonly from: number;
        readonly to: number;
    } | null;
}
/** Extracts check segments from the document. Blocks without letters are skipped. */
export declare function extractSegments(doc: PmNode, { locale, range }: ExtractOptions): DocSegment[];
/**
 * Paragraph-relative position (UTF-16, `end` exclusive) -> document range. A result covering a placeholder character (spanning code or a URL) is `null`.
 * A zero-length result (e.g. a missing space) is widened to one adjacent character.
 */
export declare function segmentRangeToDoc(segment: DocSegment, start: number, end: number): {
    from: number;
    to: number;
} | null;
/** Paragraph-relative position (`[start, end)`) overlapped by a document range. `null` if it does not overlap. */
export declare function docRangeToSegment(segment: DocSegment, from: number, to: number): {
    start: number;
    end: number;
} | null;
