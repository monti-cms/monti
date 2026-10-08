import type { TextCheckSegment, TextIssue } from "@monti-cms/core";
import type { Site } from "@monti-cms/core/client";
import { type BareunResponse } from "./mapping.js";
import type { ResolvedBareunOptions } from "./options.js";
/** Values needed to call the Bareun API. The key is handled on the server only. */
export interface BareunRequestOptions extends Pick<ResolvedBareunOptions, "baseUrl" | "customDictNames"> {
    readonly apiKey: string;
    readonly signal?: AbortSignal;
}
/** Calls Bareun spell check (`CorrectError`). On failure, throws an error carrying only the status code (no key or response body). */
export declare function requestBareun(content: string, options: BareunRequestOptions): Promise<BareunResponse>;
/** Joins paragraphs, checks them in one request, and splits the result per paragraph. Non-Korean paragraphs and empty text are not sent. */
export declare function checkWithBareun(site: Pick<Site, "createTranslator">, segments: readonly TextCheckSegment[], options: BareunRequestOptions): Promise<TextIssue[]>;
