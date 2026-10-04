import { type TextIssue } from "@monti-cms/core";
/**
 * Converts a Bareun response (`CorrectError`) into check results (`TextIssue`). Paragraphs are joined with `\n` and sent in one request (`joinSegments`),
 * and the returned positions (UTF-16 offsets over the whole text) are split back into in-paragraph positions.
 *
 * The response JSON follows proto3 rules, so fields with default values (0, empty array) may be missing.
 */
export interface BareunRevision {
    readonly revised?: string;
    readonly score?: number;
    readonly category?: string;
    readonly helpId?: string;
}
export interface BareunRevisedBlock {
    readonly origin?: {
        readonly content?: string;
        readonly beginOffset?: number;
        readonly length?: number;
    };
    readonly revised?: string;
    readonly revisions?: readonly BareunRevision[];
    /** If the block merges several fixes, the individual fixes. */
    readonly nested?: readonly BareunRevisedBlock[];
}
export interface BareunHelp {
    readonly id?: string;
    readonly category?: string;
    readonly comment?: string;
    readonly examples?: readonly string[];
    readonly ruleArticle?: string;
}
export interface BareunResponse {
    readonly origin?: string;
    readonly revised?: string;
    readonly revisedBlocks?: readonly BareunRevisedBlock[];
    readonly helps?: Readonly<Record<string, BareunHelp>>;
}
/** The paragraph shape needed to split positions (part of `TextCheckSegment`). */
export interface BareunIssueSegment {
    readonly id: string;
    readonly text: string;
}
/** Character inserted between paragraphs. Bareun treats it as a sentence boundary. */
export declare const SEGMENT_SEPARATOR = "\n";
export declare const joinSegments: (segments: readonly BareunIssueSegment[]) => string;
/**
 * Converts a Bareun response into per-paragraph check results. `segments` must be in the same order they were joined in the request.
 * Results that cross a paragraph boundary, touch the hidden placeholder (`￼`), or whose position does not match the original text are dropped.
 */
export declare function bareunIssues(segments: readonly BareunIssueSegment[], response: BareunResponse): TextIssue[];
