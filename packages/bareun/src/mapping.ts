import {
	createActiveTranslator,
	PLACEHOLDER,
	type TextIssue,
	type TextIssueCategory,
	type TextIssueSeverity,
} from "@monti-cms/core";
import { bareunMessages } from "./messages";

/**
 * 바른 응답(`CorrectError`)을 검사 결과(`TextIssue`)로 바꾼다. 문단은 `\n`으로 이어 한 번에 보내고(`joinSegments`),
 * 돌아온 위치(문서 전체의 UTF-16 위치)를 문단 안 위치로 다시 나눈다.
 *
 * 응답 JSON은 proto3 규칙이라 기본값(0·빈 배열)인 칸은 빠질 수 있다.
 */

export interface BareunRevision {
	readonly revised?: string;
	readonly score?: number;
	readonly category?: string;
	readonly helpId?: string;
}

export interface BareunRevisedBlock {
	readonly origin?: { readonly content?: string; readonly beginOffset?: number; readonly length?: number };
	readonly revised?: string;
	readonly revisions?: readonly BareunRevision[];
	/** 여러 고침을 하나로 합친 블록이면 낱낱의 고침. */
	readonly nested?: readonly BareunRevisedBlock[];
}

export interface BareunHelp {
	readonly id?: string;
	readonly category?: string;
	readonly comment?: string;
	readonly examples?: readonly string[];
	readonly ruleArticle?: string;
}

export interface BareunResponse {
	readonly origin?: string;
	readonly revised?: string;
	readonly revisedBlocks?: readonly BareunRevisedBlock[];
	readonly helps?: Readonly<Record<string, BareunHelp>>;
}

/** 위치를 나누는 데 필요한 문단 모양(`TextCheckSegment`의 일부). */
export interface BareunIssueSegment {
	readonly id: string;
	readonly text: string;
}

/** 문단 사이에 넣는 글자. 바른이 문장 경계로 본다. */
export const SEGMENT_SEPARATOR = "\n";

export const joinSegments = (segments: readonly BareunIssueSegment[]) =>
	segments.map((segment) => segment.text).join(SEGMENT_SEPARATOR);

// 사이트 설정 파일이 읽는 모듈(`index.ts`)에 묶여 있어 화면 언어는 부를 때마다 고른다.
const t = createActiveTranslator(bareunMessages);

/** 바른 분류 코드. 이름은 문구 사전의 `category.<코드>`다. */
const KINDS = new Set([
	"TYPO",
	"SPACING",
	"STANDARD",
	"GRAMMER",
	"WORD",
	"FOREIGN_WORD",
	"CONFUSABLE_WORDS",
	"SENTENCE",
	"CONFIRM",
	"THINKING",
	"UNKNOWN",
]);

const labelOf = (kind: string) => t(KINDS.has(kind) ? (`category.${kind}` as "category.UNKNOWN") : "category.CONFIRM");

const CATEGORIES: Readonly<Record<string, TextIssueCategory>> = {
	SPACING: "spacing",
	TYPO: "spelling",
	WORD: "spelling",
	STANDARD: "spelling",
	GRAMMER: "grammar",
	SENTENCE: "style",
	FOREIGN_WORD: "term",
	CONFUSABLE_WORDS: "term",
};

const ERRORS = new Set(["TYPO", "SPACING", "STANDARD", "GRAMMER", "WORD"]);

const MAX_COMMENT = 120;

/** 설명의 첫 문장. 강조 표시(`<IN>…</IN>`) 같은 꺾쇠 표시는 뺀다. */
function shortComment(comment: string | undefined): string {
	const text = (comment ?? "")
		.replace(/<\/?[A-Za-z][^>]*>/g, "")
		.replace(/\s+/g, " ")
		.trim();
	if (!text) return "";
	const first = text.match(/^.*?[.?!](?=\s|$)/)?.[0] ?? text;
	return first.length > MAX_COMMENT ? `${first.slice(0, MAX_COMMENT - 1).trimEnd()}…` : first;
}

/** 가장 작은 고침 단위. 합친 블록은 낱낱의 고침(`nested`)으로 펼친다. */
function leafBlocks(blocks: readonly BareunRevisedBlock[] | undefined): BareunRevisedBlock[] {
	return (blocks ?? []).flatMap((block) =>
		block.nested && block.nested.length > 0 ? leafBlocks(block.nested) : [block],
	);
}

/**
 * 바른 응답을 문단별 검사 결과로 바꾼다. `segments`는 요청에 이어 붙인 순서 그대로여야 한다.
 * 문단 경계를 넘거나 숨긴 자리(`￼`)에 걸친 결과, 위치와 원문이 맞지 않는 결과는 뺀다.
 */
export function bareunIssues(segments: readonly BareunIssueSegment[], response: BareunResponse): TextIssue[] {
	const content = joinSegments(segments);
	const starts: number[] = [];
	let offset = 0;
	for (const segment of segments) {
		starts.push(offset);
		offset += segment.text.length + SEGMENT_SEPARATOR.length;
	}
	const helps = response.helps ?? {};
	const seen = new Set<string>();
	const issues: TextIssue[] = [];

	for (const block of leafBlocks(response.revisedBlocks)) {
		const begin = block.origin?.beginOffset ?? 0;
		const length = block.origin?.length ?? 0;
		const end = begin + length;
		if (!Number.isInteger(begin) || !Number.isInteger(length) || length <= 0 || begin < 0 || end > content.length)
			continue;
		const origin = content.slice(begin, end);
		if (block.origin?.content !== undefined && block.origin.content !== origin) continue;
		if (origin.includes(PLACEHOLDER)) continue;

		// 시작 위치가 든 문단. 끝이 그 문단을 넘으면(문단 경계에 걸치면) 뺀다.
		let index = starts.length - 1;
		while (index > 0 && (starts[index] ?? 0) > begin) index--;
		const segment = segments[index];
		const segmentStart = starts[index] ?? 0;
		if (!segment || end > segmentStart + segment.text.length) continue;
		const start = begin - segmentStart;
		const key = `${segment.id}:${start}:${end - segmentStart}`;
		if (seen.has(key)) continue;
		seen.add(key);

		const revisions = block.revisions ?? [];
		const candidates = revisions.length > 0 ? revisions.map((revision) => revision.revised) : [block.revised];
		const suggestions = [
			...new Set(candidates.filter((text): text is string => typeof text === "string" && text !== origin)),
		];
		const first = revisions[0];
		const kind = (first?.category ?? "UNKNOWN").toUpperCase();
		const helpId = first?.helpId || undefined;
		const label = labelOf(kind);
		const comment = shortComment(helpId ? helps[helpId]?.comment : undefined);
		const severity: TextIssueSeverity = ERRORS.has(kind) ? "error" : "warning";

		issues.push({
			segmentId: segment.id,
			start,
			end: end - segmentStart,
			message: comment ? t("issue.message", { label, comment }) : label,
			suggestions,
			severity,
			...(helpId ? { ruleId: helpId } : {}),
			category: CATEGORIES[kind] ?? kind.toLowerCase(),
			source: "bareun",
		});
	}
	return issues;
}
