import type { TextIssue, TextIssueSeverity } from "./types";

/** 검사기에 보내는 글에서 인라인 코드·주소·이미지 같은 자리를 바꾼 한 글자. 검사기는 이 글자가 든 결과를 버린다. */
export const PLACEHOLDER = "\uFFFC";

/** 문단 글자 하나에 대한 검사 결과(문단 이름 없이). 캐시에 둔다. */
export type CachedIssue = Omit<TextIssue, "segmentId" | "source"> & { readonly source: string };

const SEVERITIES: readonly TextIssueSeverity[] = ["error", "warning", "info"];

/** 검사기가 돌려준 값 하나를 확인해 고친다. 위치가 문단을 벗어나는 등 쓸 수 없으면 `null`이다. */
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
