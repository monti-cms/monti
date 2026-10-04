import type { TextCheckSegment, TextIssue } from "@monti-cms/core";
import { type BareunResponse, bareunIssues, joinSegments } from "./mapping";
import type { ResolvedBareunOptions } from "./options";

/** Values needed to call the Bareun API. The key is handled on the server only. */
export interface BareunRequestOptions extends Pick<ResolvedBareunOptions, "baseUrl" | "customDictNames"> {
	readonly apiKey: string;
	readonly signal?: AbortSignal;
}

/** Calls Bareun spell check (`CorrectError`). On failure, throws an error carrying only the status code (no key or response body). */
export async function requestBareun(content: string, options: BareunRequestOptions): Promise<BareunResponse> {
	const response = await fetch(`${options.baseUrl}/bareun.RevisionService/CorrectError`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"api-key": options.apiKey,
			"connect-protocol-version": "1",
		},
		body: JSON.stringify({
			document: { content, language: "ko_KR" },
			// Positions are returned as JS string indexes (UTF-16).
			encodingType: "UTF16",
			...(options.customDictNames.length > 0 ? { customDictNames: options.customDictNames } : {}),
		}),
		signal: options.signal,
	});
	if (!response.ok) {
		// Read the body to close the connection. The error body is not exposed.
		await response.body?.cancel().catch(() => {});
		throw new Error(`Bareun request failed: HTTP ${response.status}`);
	}
	const body = (await response.json()) as unknown;
	if (!body || typeof body !== "object") throw new Error("Bareun response is not an object");
	return body as BareunResponse;
}

const isKorean = (locale: string) => locale.toLowerCase().split(/[-_]/)[0] === "ko";

/** Joins paragraphs, checks them in one request, and splits the result per paragraph. Non-Korean paragraphs and empty text are not sent. */
export async function checkWithBareun(
	segments: readonly TextCheckSegment[],
	options: BareunRequestOptions,
): Promise<TextIssue[]> {
	const korean = segments.filter((segment) => isKorean(segment.locale));
	const content = joinSegments(korean);
	if (content.trim() === "") return [];
	return bareunIssues(korean, await requestBareun(content, options));
}
