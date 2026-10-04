import type { TextIssue } from "./types.js";
/** A single character that replaces spots such as inline code, addresses and images in the text sent to the checker. The checker discards results that contain this character. */
export declare const PLACEHOLDER = "\uFFFC";
/** Check result for one paragraph's text (without the paragraph name). Kept in the cache. */
export type CachedIssue = Omit<TextIssue, "segmentId" | "source"> & {
    readonly source: string;
};
/** Verifies and fixes one value returned by the checker. `null` if it is unusable, e.g. the position leaves the paragraph. */
export declare function normalizeIssue(raw: unknown, length: number, checkerId: string): CachedIssue | null;
