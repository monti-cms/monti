import { CmsError } from "../core/store/errors";
import { normalizeIssue } from "./normalize";
import {
	DEFAULT_TEXT_CHECKER_LIMITS,
	type TextCheckContext,
	type TextCheckerLimits,
	type TextCheckSegment,
	type TextIssue,
} from "./types";

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

/** Validates the request body `{ segments: [{ id, text, locale }] }`. Throws a `CmsError` if it is invalid. */
export function parseTextCheckBody(
	body: unknown,
	limits: TextCheckerLimits = DEFAULT_TEXT_CHECKER_LIMITS,
): TextCheckSegment[] {
	const raw = (body as { segments?: unknown } | null)?.segments;
	if (!Array.isArray(raw)) throw new CmsError("segments must be an array", "invalid_input");
	const segments: TextCheckSegment[] = [];
	const ids = new Set<string>();
	for (const item of raw) {
		const { id, text, locale } = (item ?? {}) as Record<string, unknown>;
		if (typeof id !== "string" || typeof text !== "string" || typeof locale !== "string" || !id || ids.has(id))
			throw new CmsError("Each segment needs a unique id, text and locale", "invalid_input");
		ids.add(id);
		segments.push({ id, text, locale });
	}
	const maxSegments = limits.maxSegments ?? DEFAULT_TEXT_CHECKER_LIMITS.maxSegments;
	const maxChars = limits.maxChars ?? DEFAULT_TEXT_CHECKER_LIMITS.maxChars;
	const chars = segments.reduce((sum, segment) => sum + segment.text.length, 0);
	if (segments.length > maxSegments || chars > maxChars)
		throw new CmsError("Too much text in one request", "payload_too_large");
	return segments;
}

/**
 * Handles one check request (authentication is done by the wrapping route). Drops results from the checker that name paragraphs not in the request or positions outside the paragraph.
 * Checker errors keep the details (which may include keys) only in the server log and answer 502 `upstream_failed`.
 */
export async function handleTextCheck(
	body: unknown,
	{ check, limits }: TextCheckRouteOptions,
	signal: AbortSignal,
): Promise<{ readonly issues: readonly TextIssue[] }> {
	const parsed = parseTextCheckBody(body, limits);
	if (parsed.length === 0) return { issues: [] };
	let raw: readonly TextIssue[];
	try {
		raw = await check(parsed, { signal });
	} catch (error) {
		console.error("text check failed:", error);
		throw new CmsError("Text check failed", "upstream_failed");
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
	return { issues };
}
