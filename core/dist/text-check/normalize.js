/** A single character that replaces spots such as inline code, addresses and images in the text sent to the checker. The checker discards results that contain this character. */
export const PLACEHOLDER = "\uFFFC";
const SEVERITIES = ["error", "warning", "info"];
/** Verifies and fixes one value returned by the checker. `null` if it is unusable, e.g. the position leaves the paragraph. */
export function normalizeIssue(raw, length, checkerId) {
    if (!raw || typeof raw !== "object")
        return null;
    const value = raw;
    const { start, end } = value;
    if (typeof start !== "number" || typeof end !== "number")
        return null;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > length || start > end)
        return null;
    const message = typeof value.message === "string" ? value.message.trim() : "";
    const suggestions = Array.isArray(value.suggestions)
        ? value.suggestions.filter((item) => typeof item === "string")
        : [];
    if (!message && suggestions.length === 0)
        return null;
    const severity = SEVERITIES.includes(value.severity)
        ? value.severity
        : "warning";
    return {
        start,
        end,
        message,
        suggestions: [...new Set(suggestions)],
        severity,
        source: typeof value.source === "string" && value.source ? value.source : checkerId,
        ...(typeof value.ruleId === "string" ? { ruleId: value.ruleId } : {}),
        ...(typeof value.category === "string" ? { category: value.category } : {}),
        ...(typeof value.url === "string" && /^https?:\/\//.test(value.url) ? { url: value.url } : {}),
    };
}
