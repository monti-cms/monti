import type { TextCheckContext, TextCheckerLimits, TextCheckSegment, TextIssue } from "./types.js";
/** Function the server check route calls. The site calls the real checker with an API key. */
export type ServerTextCheck = (segments: readonly TextCheckSegment[], context: TextCheckContext) => Promise<readonly TextIssue[]>;
export interface TextCheckRouteOptions {
    readonly check: ServerTextCheck;
    /** Number of paragraphs and characters one request may send. Default 100 paragraphs and 20,000 characters. Beyond that it is 413. */
    readonly limits?: TextCheckerLimits;
}
export interface TextCheckResponse {
    readonly status: number;
    readonly body: {
        readonly issues: readonly TextIssue[];
    } | {
        readonly code: string;
        readonly message: string;
    };
}
/** Validates the request body `{ segments: [{ id, text, locale }] }`. Returns an error response if it is invalid. */
export declare function parseTextCheckBody(body: unknown, limits?: TextCheckerLimits): TextCheckSegment[] | TextCheckResponse;
/**
 * Handles one check request (authentication is done by the wrapping route). Drops results from the checker that name paragraphs not in the request or positions outside the paragraph.
 * Checker errors keep the details (which may include keys) only in the server log and return 502.
 */
export declare function handleTextCheck(body: unknown, { check, limits }: TextCheckRouteOptions, signal: AbortSignal): Promise<TextCheckResponse>;
