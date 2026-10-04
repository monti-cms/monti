import { z } from "zod";
import { coreMessages } from "./core.messages";
import { lazyTranslator } from "./i18n";

const t = lazyTranslator(coreMessages);

/**
 * AI 공통 정의(v2 D). 기능 정의(`action.ts`)·실행기·관리자 화면이 함께 쓰는 선택지와 결과 모양이다.
 * 서버와 브라우저가 함께 쓰므로 비밀 값이나 SDK를 넣지 않는다.
 */

/**
 * 기능이 붙는 화면 자리. 자리마다 주는 재료가 정해져 있다(`SLOT_INPUTS`).
 * `translation`은 번역본 편집기의 블록 번역(블록 메뉴와 `모두 번역`), `selection`은 본문에서 글자를 고르면 뜨는 메뉴
 * (예: 문체 다듬기, 고른 글을 바꾼다), `insert`는 슬래시(`/`) 메뉴와 빈 문서(예: 초안 쓰기, 커서에 넣는다)다.
 * `block`은 본문 블록 하나(예: Mermaid 다이어그램)의 손잡이 옆 버튼이다. 블록 원문을 보내고 바꾼 블록으로 바꾼다.
 */
export const AI_SLOTS = [
	"field",
	"image",
	"codeRules",
	"media",
	"translation",
	"selection",
	"insert",
	"block",
] as const;
export type AiSlot = (typeof AI_SLOTS)[number];

/**
 * 방식. `generate`는 대화 모델(LLM)이 글로 답을 만든다. `decide`는 판단 모델(System One, 예: Jev)이
 * 정해 둔 선택지마다 맞을 확률을 매기고, 기준 확률을 넘는 선택지만 후보가 된다. 판단 모델은 글을 만들지 않는다.
 */
export const AI_ENGINES = ["generate", "decide"] as const;
export type AiEngine = (typeof AI_ENGINES)[number];

/** 판단 방식에서 하나만 고르나(`one`), 선택지마다 따로 판단해 여러 개 고르나(`many`). */
export const AI_PICKS = ["one", "many"] as const;
export type AiPick = (typeof AI_PICKS)[number];

/**
 * 결과 모양. `candidates`는 누르는 후보 여러 개, `text`는 긴 글 하나, `mdx`는 본문 조각(MDX) 하나,
 * `note`는 보여 주기만 하는 메모.
 */
export const AI_RESULTS = ["candidates", "text", "mdx", "note"] as const;
export type AiResult = (typeof AI_RESULTS)[number];

/** 적용 방식. `append`는 목록 값(태그·정규식 규칙)에 더한다. */
export const AI_APPLIES = ["replace", "append", "none"] as const;
export type AiApply = (typeof AI_APPLIES)[number];

/**
 * 결과 검사. 기능마다 목록으로 정하고(기능 편집기에 모두 보인다), 통과하지 못한 후보는 버린다.
 * 정해진 검사는 어느 기능에나 쓰는 것만 둔다.
 * - `pattern`: 정규식에 맞는 값만
 * - `maxLength`: 최대 글자 수를 넘지 않는 값만
 * - `exists`: 선택지(`choices`)에 실제로 있는 값만
 * - `oneOf`: 정해 둔 목록(`items`) 중 하나인 것만
 *
 * 기능마다 다른 검사(주소 중복, 정규식 실행, 번역 구조 등)는 코드 검사(`defineValidator`)로 만들어 기능의 `checks`에 넣는다.
 * 고친 값에는 그 이름(`{ kind: "code", name }`)과 켜기만 남는다.
 */
export const AI_CHECK_KINDS = ["pattern", "maxLength", "exists", "oneOf"] as const;
export type AiCheckKind = (typeof AI_CHECK_KINDS)[number];

/** 코드 검사 이름(소문자·숫자·하이픈). */
export const CODE_CHECK_NAME = /^[a-z][a-z0-9-]*$/;

const patternSchema = z
	.string()
	.trim()
	.min(1)
	.max(500)
	.refine(
		(pattern) => {
			try {
				new RegExp(pattern, "u");
				return true;
			} catch {
				return false;
			}
		},
		{ error: () => t("check.invalidRegex") },
	);

/** 검사 하나. 기능마다 정해 둔 검사를 켜고 끄며, 형식·길이는 값을 고친다. */
const enabled = z.boolean().default(true);
export const aiCheckSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("pattern"), enabled, pattern: patternSchema }),
	z.object({ kind: z.literal("maxLength"), enabled, max: z.number().int().min(1).max(5000) }),
	z.object({ kind: z.literal("exists"), enabled }),
	z.object({ kind: z.literal("oneOf"), enabled, items: z.array(z.string().trim().min(1).max(200)).min(1).max(100) }),
	z.object({ kind: z.literal("code"), enabled, name: z.string().max(60).regex(CODE_CHECK_NAME) }),
]);
export type AiCheck = z.output<typeof aiCheckSchema>;
export type AiCheckInput = z.input<typeof aiCheckSchema>;

/** 검사 목록 안에서 검사 하나를 가리키는 이름. 코드 검사는 이름마다 하나, 나머지는 종류마다 하나다. */
export const checkKey = (check: Pick<AiCheck, "kind"> & { name?: string }) =>
	check.kind === "code" ? `code:${check.name}` : check.kind;

/** 정해진 검사였다가 코드 검사로 옮긴 것(저장된 고친 값을 읽을 때 옮긴다). */
const MOVED_TO_CODE: Readonly<Record<string, string>> = {
	unique: "unique-slug",
	regexRuns: "regex-runs",
	structure: "same-structure",
};

/** 저장된 검사 하나를 지금 모양으로. 코드 검사로 옮긴 종류는 같은 이름의 코드 검사로 바꾼다. */
export function migrateCheck(value: unknown): unknown {
	if (!value || typeof value !== "object" || !("kind" in value)) return value;
	const { kind, enabled } = value as { kind?: unknown; enabled?: unknown };
	const name = typeof kind === "string" ? MOVED_TO_CODE[kind] : undefined;
	return name ? { kind: "code", name, ...(typeof enabled === "boolean" ? { enabled } : {}) } : value;
}

/** 관리자 화면에서 어느 기능에든 더할 수 있는 검사와 처음 값. 나머지는 기능 정의가 정한다. */
export const ADDABLE_CHECKS = {
	pattern: { kind: "pattern", enabled: true, pattern: ".+" },
	maxLength: { kind: "maxLength", enabled: true, max: 100 },
	oneOf: { kind: "oneOf", enabled: true, items: ["value"] },
} as const satisfies Partial<Record<AiCheckKind, AiCheck>>;
export type AddableCheckKind = keyof typeof ADDABLE_CHECKS;
export const isAddableCheck = (kind: string): kind is AddableCheckKind => Object.hasOwn(ADDABLE_CHECKS, kind);

/** 판단 모델에 한 번에 물을 수 있는 선택지 수. */
export const MAX_DECISION_OPTIONS = 255;

export const MAX_PROMPT_LENGTH = 4000;
export const MAX_REQUEST_LENGTH = 1000;

/** 자리에 결과로 보여 줄 후보 하나. `value`가 적용될 값이고 `label`은 보이는 글자다. */
export interface AiCandidate {
	value: string;
	label: string;
	/** 덧붙일 짧은 설명(정규식이 찾은 곳 수 등). */
	detail?: string;
}

export type AiRunResult =
	| { kind: "candidates"; items: AiCandidate[] }
	| { kind: "text"; text: string }
	| { kind: "mdx"; text: string }
	| { kind: "note"; text: string };

/**
 * 화면 자리가 누를 때 넘기는 지금 상황. 자리마다 아는 값만 채운다. 기능의 입력(`action.input`)으로 옮겨 보낸다.
 * 태그 목록과 이미지는 서버가 직접 읽는다(브라우저가 보낸 목록·주소를 믿지 않는다).
 */
export interface AiRunContext {
	/** 실행할 때 적은 추가 요청. 기능이 `askInstruction`일 때만 지시문에 붙는다. */
	request?: string;
	collection?: string;
	locale?: string;
	entryId?: string;
	title?: string;
	summary?: string;
	body?: string;
	/** 대상의 현재 값. 목록 값(태그 id 등)은 배열이다. */
	current?: string | readonly string[];
	around?: string;
	/** 선택 영역 메뉴에서 고른 글(MDX). */
	selection?: string;
	code?: string;
	language?: string;
	mediaId?: string;
	/** 미디어 라이브러리 밖 이미지의 사이트 주소(`/images/...`). 서버가 자기 사이트에서 읽는다. */
	imageSrc?: string;
	filename?: string;
}

/**
 * 검사 목록을 두기 전(`check` 하나 + `maxLength`)에 저장한 값을 검사 목록으로 옮긴다.
 * 예전 `ai_features` 행을 고친 값으로 옮길 때 쓴다.
 */
export function migrateLegacyCheck(value: unknown): unknown {
	if (!value || typeof value !== "object" || "checks" in value || !("check" in value)) return value;
	// 예전 `slug`·`filename` 검사가 쓰던 형식(그때 값 그대로).
	const LEGACY_KEBAB = "^[a-z0-9]+(?:-[a-z0-9]+)*$";
	const { check, maxLength, ...rest } = value as { check?: unknown; maxLength?: unknown };
	const legacy: Record<string, AiCheckInput[]> = {
		slug: [
			{ kind: "pattern", pattern: LEGACY_KEBAB },
			{ kind: "code", name: "unique-slug" },
		],
		tags: [{ kind: "exists" }],
		regex: [{ kind: "code", name: "regex-runs" }],
		filename: [{ kind: "pattern", pattern: LEGACY_KEBAB }],
		maxLength: typeof maxLength === "number" ? [{ kind: "maxLength", max: maxLength }] : [],
	};
	return { ...rest, checks: typeof check === "string" ? (legacy[check] ?? []) : [] };
}
