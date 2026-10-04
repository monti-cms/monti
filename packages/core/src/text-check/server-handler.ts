import { normalizeIssue } from "./normalize";
import type { TextCheckContext, TextCheckerLimits, TextCheckSegment, TextIssue } from "./types";

/** 서버 검사 경로가 부르는 함수. 사이트가 API 키로 실제 검사기를 부른다. */
export type ServerTextCheck = (
	segments: readonly TextCheckSegment[],
	context: TextCheckContext,
) => Promise<readonly TextIssue[]>;

export interface TextCheckRouteOptions {
	readonly check: ServerTextCheck;
	/** 한 요청이 보낼 수 있는 문단 수·글자 수. 기본 100문단·20,000자. 넘으면 413이다. */
	readonly limits?: TextCheckerLimits;
}

const DEFAULT_LIMITS = { maxSegments: 100, maxChars: 20_000 } as const;

export interface TextCheckResponse {
	readonly status: number;
	readonly body: { readonly issues: readonly TextIssue[] } | { readonly code: string; readonly message: string };
}

const fail = (status: number, code: string, message: string): TextCheckResponse => ({
	status,
	body: { code, message },
});

/** 요청 본문 `{ segments: [{ id, text, locale }] }`를 확인한다. 잘못됐으면 오류 응답을 돌려준다. */
export function parseTextCheckBody(
	body: unknown,
	limits: TextCheckerLimits = DEFAULT_LIMITS,
): TextCheckSegment[] | TextCheckResponse {
	const raw = (body as { segments?: unknown } | null)?.segments;
	if (!Array.isArray(raw)) return fail(400, "invalid_input", "segments must be an array");
	const segments: TextCheckSegment[] = [];
	const ids = new Set<string>();
	for (const item of raw) {
		const { id, text, locale } = (item ?? {}) as Record<string, unknown>;
		if (typeof id !== "string" || typeof text !== "string" || typeof locale !== "string" || !id || ids.has(id))
			return fail(400, "invalid_input", "Each segment needs a unique id, text and locale");
		ids.add(id);
		segments.push({ id, text, locale });
	}
	const maxSegments = limits.maxSegments ?? DEFAULT_LIMITS.maxSegments;
	const maxChars = limits.maxChars ?? DEFAULT_LIMITS.maxChars;
	const chars = segments.reduce((sum, segment) => sum + segment.text.length, 0);
	if (segments.length > maxSegments || chars > maxChars) return fail(413, "too_large", "Too much text in one request");
	return segments;
}

/**
 * 검사 요청 하나를 처리한다(인증은 감싸는 경로가 한다). 검사기 결과 중 요청에 없는 문단이나 문단을 벗어난 위치는 뺀다.
 * 검사기 오류는 자세한 내용(키가 섞일 수 있다)을 서버 기록에만 남기고 502로 돌려준다.
 */
export async function handleTextCheck(
	body: unknown,
	{ check, limits }: TextCheckRouteOptions,
	signal: AbortSignal,
): Promise<TextCheckResponse> {
	const parsed = parseTextCheckBody(body, limits);
	if (!Array.isArray(parsed)) return parsed;
	if (parsed.length === 0) return { status: 200, body: { issues: [] } };
	let raw: readonly TextIssue[];
	try {
		raw = await check(parsed, { signal });
	} catch (error) {
		console.error("text check failed:", error);
		return fail(502, "text_check_failed", "Text check failed");
	}
	const lengths = new Map(parsed.map((segment) => [segment.id, segment.text.length]));
	const issues: TextIssue[] = [];
	for (const item of Array.isArray(raw) ? raw : []) {
		const segmentId = (item as { segmentId?: unknown })?.segmentId;
		const length = typeof segmentId === "string" ? lengths.get(segmentId) : undefined;
		if (typeof segmentId !== "string" || length === undefined) continue;
		// 출처가 없으면 비워 둔다. 브라우저 쪽이 검사기 `id`로 채운다.
		const issue = normalizeIssue(item, length, "");
		if (!issue) continue;
		const { source, ...rest } = issue;
		issues.push({ ...rest, segmentId, ...(source ? { source } : {}) });
	}
	return { status: 200, body: { issues } };
}
