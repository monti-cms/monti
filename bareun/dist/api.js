import { bareunIssues, joinSegments } from "./mapping.js";
/** Calls Bareun spell check (`CorrectError`). On failure, throws an error carrying only the status code (no key or response body). */
export async function requestBareun(content, options) {
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
        await response.body?.cancel().catch(() => { });
        throw new Error(`Bareun request failed: HTTP ${response.status}`);
    }
    const body = (await response.json());
    if (!body || typeof body !== "object")
        throw new Error("Bareun response is not an object");
    return body;
}
const isKorean = (locale) => locale.toLowerCase().split(/[-_]/)[0] === "ko";
/** Joins paragraphs, checks them in one request, and splits the result per paragraph. Non-Korean paragraphs and empty text are not sent. */
export async function checkWithBareun(segments, options) {
    const korean = segments.filter((segment) => isKorean(segment.locale));
    const content = joinSegments(korean);
    if (content.trim() === "")
        return [];
    return bareunIssues(korean, await requestBareun(content, options));
}
