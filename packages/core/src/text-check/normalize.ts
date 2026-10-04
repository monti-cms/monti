import type { TextIssue, TextIssueSeverity } from "./types";

/** A single character that replaces spots such as inline code, addresses and images in the text sent to the checker. The checker discards results that contain this character. */
export const PLACEHOLDER = "\uFFFC";

/** Check result for one paragraph's text (without the paragraph name). Kept in the cache. */
export type CachedIssue = Omit<TextIssue, "segmentId" | "source"> & { readonly source: string };

const SEVERITIES: readonly TextIssueSeverity[] = ["error", "warning", "info"];

/** Verifies and fixes one value returned by the checker. `null` if it is unusable, e.g. the position leaves the paragraph. */
export function normalizeIssue(raw: unknown, length: number, checkerId: string): CachedIssue | null {
	if (!raw || typeof raw !== "object") return null;
	const value = raw as Record<string, unknown>;
	const { start, end } = value;
	if (typeof start !== "number" || typeof end !== "number") return null;
	if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > length || start > end) return null;
	const message = typeof value.message === "string" ? value.message.trim() : "";
	const suggestions = Array.isArray(value.suggestions)
		? value.suggestions.filter((item): item is string => typeof item === "string")
		: [];
	if (!message && suggestions.length === 0) return null;
	const severity = SEVERITIES.includes(value.severity as TextIssueSeverity)
		? (value.severity as TextIssueSeverity)
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
