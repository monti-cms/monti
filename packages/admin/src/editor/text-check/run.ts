import {
	type CachedIssue,
	normalizeIssue,
	type TextChecker,
	type TextCheckerLimits,
	type TextCheckSegment,
	type TextIssue,
} from "@monti-cms/core/client";
import { type DocSegment, segmentRangeToDoc } from "./extract";

export type { CachedIssue };

/** 편집기에 그리는 결과. `from`·`to`는 지금 문서 위치다. */
export interface DocTextIssue extends CachedIssue {
	readonly key: string;
	readonly checkerId: string;
	readonly from: number;
	readonly to: number;
	/** 표시한 글자. */
	readonly text: string;
}

/** 검사기·언어·문단 글자 → 결과. 같은 글자는 다시 보내지 않는다. */
export class TextCheckCache {
	private readonly entries = new Map<string, readonly CachedIssue[]>();
	constructor(private readonly maxEntries = 2000) {}

	private static key(checkerId: string, locale: string, text: string) {
		return `${checkerId}\u0000${locale}\u0000${text}`;
	}
	get(checkerId: string, locale: string, text: string) {
		return this.entries.get(TextCheckCache.key(checkerId, locale, text));
	}
	has(checkerId: string, locale: string, text: string) {
		return this.entries.has(TextCheckCache.key(checkerId, locale, text));
	}
	set(checkerId: string, locale: string, text: string, issues: readonly CachedIssue[]) {
		const key = TextCheckCache.key(checkerId, locale, text);
		this.entries.delete(key);
		this.entries.set(key, issues);
		if (this.entries.size > this.maxEntries) {
			const oldest = this.entries.keys().next().value;
			if (oldest !== undefined) this.entries.delete(oldest);
		}
	}
}

/** 한도(`limits`)에 맞게 문단을 나눈다. 한 문단이 `maxChars`보다 길면 그 문단만 한 묶음이다. */
export function chunkSegments<T extends TextCheckSegment>(
	segments: readonly T[],
	limits: TextCheckerLimits = {},
): T[][] {
	const maxSegments = limits.maxSegments ?? Number.POSITIVE_INFINITY;
	const maxChars = limits.maxChars ?? Number.POSITIVE_INFINITY;
	const chunks: T[][] = [];
	let current: T[] = [];
	let chars = 0;
	for (const segment of segments) {
		const size = segment.text.length;
		if (current.length > 0 && (current.length >= maxSegments || chars + size > maxChars)) {
			chunks.push(current);
			current = [];
			chars = 0;
		}
		current.push(segment);
		chars += size;
	}
	if (current.length > 0) chunks.push(current);
	return chunks;
}

const abortError = () => new DOMException("Text check aborted", "AbortError");

/**
 * 캐시에 없는 문단만 검사기에 보내고 결과를 캐시에 넣는다. 같은 글자의 문단은 한 번만 보낸다.
 * 묶음은 차례로 보낸다(호출 제한). 끊으면 `AbortError`를 던진다.
 */
export async function checkSegments({
	checker,
	segments,
	locale,
	cache,
	signal,
}: {
	checker: TextChecker;
	segments: readonly DocSegment[];
	locale: string;
	cache: TextCheckCache;
	signal: AbortSignal;
}): Promise<void> {
	const pending = new Map<string, TextCheckSegment>();
	for (const segment of segments) {
		if (cache.has(checker.id, locale, segment.text) || pending.has(segment.text)) continue;
		// 검사기에는 이름·글자·언어만 넘긴다(문서 위치는 넘기지 않는다).
		pending.set(segment.text, { id: segment.id, text: segment.text, locale });
	}
	for (const chunk of chunkSegments([...pending.values()], checker.limits)) {
		if (signal.aborted) throw abortError();
		const issues = await checker.check(chunk, { signal });
		if (signal.aborted) throw abortError();
		if (!Array.isArray(issues)) throw new Error(`text checker "${checker.id}" did not return an array`);
		const byId = new Map<string, CachedIssue[]>(chunk.map((segment) => [segment.id, []]));
		const lengths = new Map(chunk.map((segment) => [segment.id, segment.text.length]));
		for (const raw of issues) {
			const segmentId = (raw as { segmentId?: unknown })?.segmentId;
			const length = typeof segmentId === "string" ? lengths.get(segmentId) : undefined;
			if (length === undefined || typeof segmentId !== "string") continue;
			const issue = normalizeIssue(raw, length, checker.id);
			if (issue) byId.get(segmentId)?.push(issue);
		}
		for (const segment of chunk) cache.set(checker.id, locale, segment.text, byId.get(segment.id) ?? []);
	}
}

/** "무시"로 숨기는 기준: 같은 검사기·규칙(없으면 문구)·글자. */
export const ignoreKey = (issue: Pick<DocTextIssue, "checkerId" | "ruleId" | "message" | "text">) =>
	`${issue.checkerId}\u0000${issue.ruleId ?? issue.message}\u0000${issue.text}`;

let issueCounter = 0;

const inScope = (issue: CachedIssue, scope: { start: number; end: number }) =>
	issue.start === issue.end
		? issue.start >= scope.start && issue.start <= scope.end
		: issue.start < scope.end && issue.end > scope.start;

/**
 * 캐시에 있는 결과를 지금 문서의 문단에 놓는다. `scope`가 있으면 그 문단 안 범위에 걸친 결과만 둔다(선택 영역 검사).
 */
export function placeIssues({
	checkers,
	segments,
	locale,
	cache,
	ignored,
	scopes,
}: {
	checkers: readonly TextChecker[];
	segments: readonly DocSegment[];
	locale: string;
	cache: TextCheckCache;
	ignored?: ReadonlySet<string>;
	scopes?: ReadonlyMap<string, { start: number; end: number }>;
}): DocTextIssue[] {
	const placed: DocTextIssue[] = [];
	for (const segment of segments) {
		const scope = scopes?.get(segment.id);
		for (const checker of checkers) {
			for (const issue of cache.get(checker.id, locale, segment.text) ?? []) {
				if (scope && !inScope(issue, scope)) continue;
				const range = segmentRangeToDoc(segment, issue.start, issue.end);
				if (!range) continue;
				const text = segment.text.slice(issue.start, issue.end);
				const docIssue: DocTextIssue = {
					...issue,
					key: `i${++issueCounter}`,
					checkerId: checker.id,
					from: range.from,
					to: range.to,
					text,
				};
				if (ignored?.has(ignoreKey(docIssue))) continue;
				placed.push(docIssue);
			}
		}
	}
	return placed.sort((a, b) => a.from - b.from || a.to - b.to);
}
