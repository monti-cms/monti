import { normalizeIssue } from "./normalize";
import type { TextCheckContext, TextCheckerLimits, TextCheckSegment, TextIssue } from "./types";

/** Function the server check route calls. The site calls the real checker with an API key. */
export type ServerTextCheck = (
	segments: readonly TextCheckSegment[],
	context: TextCheckContext,
) => Promise<readonly TextIssue[]>;

export interface TextCheckRouteOptions {
	readonly check: ServerTextCheck;
	/** Number of paragraphs and characters one request may send. Default 100 paragraphs and 20,000 characters. Beyond that it is 413. */
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

/** Validates the request body `{ segments: [{ id, text, locale }] }`. Returns an error response if it is invalid. */
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
 * Handles one check request (authentication is done by the wrapping route). Drops results from the checker that name paragraphs not in the request or positions outside the paragraph.
 * Checker errors keep the details (which may include keys) only in the server log and return 502.
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
		// If there is no source, leave it empty. The browser side fills it with the checker `id`.
		const issue = normalizeIssue(item, length, "");
		if (!issue) continue;
		const { source, ...rest } = issue;
		issues.push({ ...rest, segmentId, ...(source ? { source } : {}) });
	}
	return { status: 200, body: { issues } };
}
