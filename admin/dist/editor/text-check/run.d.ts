import { type CachedIssue, type TextChecker, type TextCheckerLimits, type TextCheckSegment } from "@monti-cms/core/client";
import { type DocSegment } from "./extract.js";
export type { CachedIssue };
/** Result drawn in the editor. `from` and `to` are current document positions. */
export interface DocTextIssue extends CachedIssue {
    readonly key: string;
    readonly checkerId: string;
    readonly from: number;
    readonly to: number;
    /** The marked text. */
    readonly text: string;
}
/** Checker, language, paragraph text → result. The same text is not sent again. */
export declare class TextCheckCache {
    private readonly maxEntries;
    private readonly entries;
    constructor(maxEntries?: number);
    private static key;
    get(checkerId: string, locale: string, text: string): readonly CachedIssue[] | undefined;
    has(checkerId: string, locale: string, text: string): boolean;
    set(checkerId: string, locale: string, text: string, issues: readonly CachedIssue[]): void;
}
/** Splits paragraphs to fit the limits (`limits`). A paragraph longer than `maxChars` becomes a batch by itself. */
export declare function chunkSegments<T extends TextCheckSegment>(segments: readonly T[], limits?: TextCheckerLimits): T[][];
/**
 * Sends only paragraphs not in the cache to the checker and puts the results in the cache. A paragraph with the same text is sent only once.
 * Batches are sent in order (rate limit). Throws `AbortError` if aborted.
 */
export declare function checkSegments({ checker, segments, locale, cache, signal, }: {
    checker: TextChecker;
    segments: readonly DocSegment[];
    locale: string;
    cache: TextCheckCache;
    signal: AbortSignal;
}): Promise<void>;
/** Basis for hiding with "ignore": same checker, rule (or message if none), and text. */
export declare const ignoreKey: (issue: Pick<DocTextIssue, "checkerId" | "ruleId" | "message" | "text">) => string;
/**
 * Places the cached results onto the paragraphs of the current document. With `scope`, only results spanning ranges within that paragraph are placed (selection check).
 */
export declare function placeIssues({ checkers, segments, locale, cache, ignored, scopes, }: {
    checkers: readonly TextChecker[];
    segments: readonly DocSegment[];
    locale: string;
    cache: TextCheckCache;
    ignored?: ReadonlySet<string>;
    scopes?: ReadonlyMap<string, {
        start: number;
        end: number;
    }>;
}): DocTextIssue[];
