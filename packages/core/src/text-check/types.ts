/**
 * 맞춤법·문장 검사 확장의 공통 모양. 본체는 검사기를 하나도 넣지 않는다. 사이트·확장이 필요한 검사기를 만들어
 * 관리자 확장점 `textCheckers`(`CmsAdminComponentsProvider`)에 넣으면 편집기가 버튼·밑줄·결과 창을 그린다.
 *
 * 위치는 늘 문단(검사 단위) 안의 UTF-16 위치(JS 문자열 인덱스)다. 바이트·코드 포인트·문장 기준 위치를 주는
 * 검사기는 검사기 쪽에서 바꿔 돌려준다.
 */

/** 검사 단위 하나. 편집기 문단(제목·목록 항목·표 칸 등 글이 든 블록) 하나의 글자다. */
export interface TextCheckSegment {
	/** 글자가 같은 동안 바뀌지 않는 이름. 결과(`TextIssue.segmentId`)가 이 이름으로 문단을 가리킨다. */
	readonly id: string;
	readonly text: string;
	/** 글의 언어(`ko`·`en` 등 사이트 설정의 언어 코드). */
	readonly locale: string;
}

export type TextIssueSeverity = "error" | "warning" | "info";

/** 흔한 분류. 검사기가 다른 이름을 써도 된다. */
export type TextIssueCategory = "spelling" | "spacing" | "grammar" | "style" | "term" | (string & {});

/** 검사 결과 하나. `start`·`end`는 그 문단 안의 UTF-16 위치이고 `end`는 포함하지 않는다. */
export interface TextIssue {
	readonly segmentId: string;
	readonly start: number;
	readonly end: number;
	readonly message: string;
	/** 바꿀 글 후보. 없으면 빈 배열. */
	readonly suggestions: readonly string[];
	readonly severity: TextIssueSeverity;
	readonly ruleId?: string;
	readonly category?: TextIssueCategory;
	/** 결과를 낸 검사기 이름. 비우면 편집기가 검사기 `id`로 채운다. */
	readonly source?: string;
	/** 규칙 설명 주소. */
	readonly url?: string;
}

export interface TextCheckerLimits {
	/** 한 번에 보낼 글자 수(UTF-16) 상한. 넘으면 여러 번 나눠 보낸다. 한 문단이 이보다 길면 그 문단만 따로 보낸다. */
	readonly maxChars?: number;
	/** 한 번에 보낼 문단 수 상한. */
	readonly maxSegments?: number;
}

export interface TextCheckContext {
	/** 다시 검사하거나 편집 화면을 닫으면 끊는다. `fetch`에 그대로 넘긴다. */
	readonly signal: AbortSignal;
}

export interface TextChecker {
	readonly id: string;
	/** 도구 모음 버튼 이름이자 결과 창의 출처. 예: "바른 맞춤법 검사". */
	readonly label: string;
	/**
	 * 도구 모음 버튼 아이콘. lucide 컴포넌트나 아이콘 이름(관리자 확장 `icons`에 등록한 이름 포함). 없으면 맞춤법 아이콘.
	 * 검사기마다 버튼이 하나씩 생긴다.
	 */
	readonly icon?: string | import("react").ComponentType<{ className?: string }>;
	/** 검사할 수 있는 언어. 없으면 모든 언어다. `ko`는 `ko-KR`과도 맞는다. */
	readonly locales?: readonly string[];
	/** 편집을 멈추면 바뀐 문단만 저절로 검사한다. 기본은 끔(유료·호출 제한 API를 생각해 버튼으로만 검사). */
	readonly auto: boolean;
	readonly limits?: TextCheckerLimits;
	readonly check: (segments: readonly TextCheckSegment[], context: TextCheckContext) => Promise<readonly TextIssue[]>;
}

export interface TextCheckerOptions extends Omit<TextChecker, "auto"> {
	readonly auto?: boolean;
}

/** 검사기를 만든다. 브라우저에서 돈다. API 키가 필요한 검사기는 `remoteTextChecker`로 사이트 서버 경로를 거친다. */
export function defineTextChecker(options: TextCheckerOptions): TextChecker {
	if (!/^[a-z0-9][a-z0-9_-]*$/i.test(options.id)) throw new Error(`text checker: invalid id "${options.id}"`);
	for (const [key, value] of Object.entries(options.limits ?? {})) {
		if (value !== undefined && (!Number.isInteger(value) || value <= 0))
			throw new Error(`text checker "${options.id}": limits.${key} must be a positive integer`);
	}
	return Object.freeze({ ...options, auto: options.auto ?? false });
}

/** 언어 코드의 첫 부분(`ko-KR` → `ko`). */
const baseLanguage = (locale: string) => locale.toLowerCase().split(/[-_]/)[0] ?? "";

/** 그 글의 언어를 검사할 수 있는가. */
export function supportsLocale(checker: TextChecker, locale: string): boolean {
	if (!checker.locales || checker.locales.length === 0) return true;
	const target = locale.toLowerCase();
	return checker.locales.some((code) => code.toLowerCase() === target || baseLanguage(code) === baseLanguage(locale));
}
