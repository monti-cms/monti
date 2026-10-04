import { normalizeIssue } from "./normalize.js";
const DEFAULT_LIMITS = { maxSegments: 100, maxChars: 20_000 };
const fail = (status, code, message) => ({
    status,
    body: { code, message },
});
/** Validates the request body `{ segments: [{ id, text, locale }] }`. Returns an error response if it is invalid. */
export function parseTextCheckBody(body, limits = DEFAULT_LIMITS) {
    const raw = body?.segments;
    if (!Array.isArray(raw))
        return fail(400, "invalid_input", "segments must be an array");
    const segments = [];
    const ids = new Set();
    for (const item of raw) {
        const { id, text, locale } = (item ?? {});
        if (typeof id !== "string" || typeof text !== "string" || typeof locale !== "string" || !id || ids.has(id))
            return fail(400, "invalid_input", "Each segment needs a unique id, text and locale");
        ids.add(id);
        segments.push({ id, text, locale });
    }
    const maxSegments = limits.maxSegments ?? DEFAULT_LIMITS.maxSegments;
    const maxChars = limits.maxChars ?? DEFAULT_LIMITS.maxChars;
    const chars = segments.reduce((sum, segment) => sum + segment.text.length, 0);
    if (segments.length > maxSegments || chars > maxChars)
        return fail(413, "too_large", "Too much text in one request");
    return segments;
}
/**
 * Handles one check request (authentication is done by the wrapping route). Drops results from the checker that name paragraphs not in the request or positions outside the paragraph.
 * Checker errors keep the details (which may include keys) only in the server log and return 502.
 */
export async function handleTextCheck(body, { check, limits }, signal) {
    const parsed = parseTextCheckBody(body, limits);
    if (!Array.isArray(parsed))
        return parsed;
    if (parsed.length === 0)
        return { status: 200, body: { issues: [] } };
    let raw;
    try {
        raw = await check(parsed, { signal });
    }
    catch (error) {
        console.error("text check failed:", error);
        return fail(502, "text_check_failed", "Text check failed");
    }
    const lengths = new Map(parsed.map((segment) => [segment.id, segment.text.length]));
    const issues = [];
    for (const item of Array.isArray(raw) ? raw : []) {
        const segmentId = item?.segmentId;
        const length = typeof segmentId === "string" ? lengths.get(segmentId) : undefined;
        if (typeof segmentId !== "string" || length === undefined)
            continue;
        // If there is no source, leave it empty. The browser side fills it with the checker `id`.
        const issue = normalizeIssue(item, length, "");
        if (!issue)
            continue;
        const { source, ...rest } = issue;
        issues.push({ ...rest, segmentId, ...(source ? { source } : {}) });
    }
    return { status: 200, body: { issues } };
}
