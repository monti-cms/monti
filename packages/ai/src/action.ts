import type { BlockDefinition, CollectionsConfig } from "@monti-cms/core";
import { z } from "zod";
import { coreMessages } from "./core.messages";
import {
	type AiApply,
	type AiCandidate,
	type AiCheck,
	type AiCheckInput,
	type AiEngine,
	type AiPick,
	type AiResult,
	type AiSlot,
	aiCheckSchema,
	CODE_CHECK_NAME,
	checkKey,
	isAddableCheck,
	MAX_PROMPT_LENGTH,
	MAX_REQUEST_LENGTH,
	migrateCheck,
} from "./definition";
import { lazyTranslator } from "./i18n";

const t = lazyTranslator(coreMessages);

/**
 * AI 기능 정의(v2 D, M2). 기능 하나는 이름(key)으로 사이트 설정의 `ai.actions`에 적는다.
 *
 * - **입력**: 부르는 쪽이 주는 재료(제목·본문·이미지·언어…). 재료는 지시문에 끼우지 않고 따로 보낸다
 *   (글 안의 지시 같은 문장을 모델이 따르지 않게). 지시문의 `{{이름}}`에는 언어 입력만 넣을 수 있다.
 * - **결과**: 후보 여러 개·글 하나·본문 조각(MDX)·메모 중 하나와 검사 목록.
 * - **붙을 곳(`attach`)**: 관리자 화면의 정해진 자리(필드 옆·이미지·미디어·코드 블록·번역). 자리가 주는 재료로
 *   입력을 채울 수 있을 때만 붙일 수 있다(타입과 `defineConfig`가 확인한다).
 *
 * 관리자 AI 화면에서는 켜기·요청 받기·연결·모델·보낼 입력·지시문·기준값·검사 값만 고치고, 고친 값만 DB에 둔다.
 * 정의는 서버와 브라우저가 함께 읽는다. 코드 검사(`defineValidator`)의 함수는 서버에서만 부른다.
 */

// ---------------------------------------------------------------------------
// 입력
// ---------------------------------------------------------------------------

/**
 * 입력 종류. `text`·`mdx`·`code`는 글, `value`는 필드의 현재 값(글 또는 목록), `image`는 서버가 읽을 이미지
 * (미디어 ID 또는 이 사이트 경로), `locale`은 언어 코드다(지시문에 언어 이름으로 들어간다).
 */
export type AiInputKind = "text" | "mdx" | "code" | "value" | "image" | "locale";

export interface AiInputSpec<K extends AiInputKind = AiInputKind> {
	readonly kind: K;
	/** 관리자 화면의 `보낼 내용`과 지시문에 붙는 언어 줄에 쓰는 이름. */
	readonly label: string;
	/** 없으면 실행하지 않는다. 표시가 없으면 비어 있어도 된다(비면 보내지 않는다). */
	readonly required?: boolean;
}

export type AiInputs = Readonly<Record<string, AiInputSpec>>;

type InputOptions = { readonly label: string; readonly required?: boolean };

const inputOf =
	<K extends AiInputKind>(kind: K) =>
	<const O extends InputOptions>(options: O) =>
		({ kind, ...options }) as const satisfies AiInputSpec<K>;

export const aiInput = {
	text: inputOf("text"),
	mdx: inputOf("mdx"),
	code: inputOf("code"),
	value: inputOf("value"),
	image: inputOf("image"),
	locale: inputOf("locale"),
};

/** 입력 값의 타입. 이미지는 서버가 읽을 위치만 준다. */
export type AiInputValue<S> = S extends { readonly kind: "image" }
	? { readonly mediaId?: string; readonly src?: string }
	: S extends { readonly kind: "value" }
		? string | readonly string[]
		: string;

/** 입력 하나의 최대 길이(글자). */
const INPUT_LIMITS: Record<Exclude<AiInputKind, "image" | "value" | "locale">, number> = {
	text: 20_000,
	mdx: 200_000,
	code: 100_000,
};

// ---------------------------------------------------------------------------
// 붙을 곳
// ---------------------------------------------------------------------------

/**
 * 자리마다 주는 재료. 기능의 필수 입력이 모두 여기에 있어야 그 자리에 붙일 수 있다.
 * 필수가 아닌 입력은 자리에 없으면 비운 채로 보낸다(예: 미디어 화면의 대체 텍스트에는 앞뒤 문단이 없다).
 */
export const SLOT_INPUTS = {
	field: { title: "text", summary: "text", body: "mdx", current: "value" },
	image: { image: "image", around: "text", current: "value" },
	media: { image: "image", filename: "text", current: "value" },
	codeRules: { code: "code" },
	translation: { block: "mdx", from: "locale", to: "locale" },
	selection: { selection: "mdx", title: "text" },
	insert: { title: "text", body: "mdx" },
	block: { block: "mdx", title: "text" },
} as const satisfies Record<AiSlot, Readonly<Record<string, AiInputKind>>>;

type SlotInputNames = { [S in AiSlot]: keyof (typeof SLOT_INPUTS)[S] };

export type AiAttach =
	/** 필드 옆. `collections`가 없으면 그 필드가 있는 모든 컬렉션. */
	| { readonly slot: "field"; readonly field: string; readonly collections?: readonly string[] }
	| { readonly slot: "image"; readonly target: "alt" | "caption" }
	| { readonly slot: "media"; readonly target: "filename" | "defaultAlt" | "defaultCaption" }
	| { readonly slot: "codeRules"; readonly target: "fold" }
	/** 번역본 편집기의 블록 번역(블록 메뉴·`모두 번역`). */
	| { readonly slot: "translation" }
	/** 본문 선택 영역 메뉴. 결과(MDX)는 바뀐 곳을 보여 준 뒤 고른 글을 바꾼다. */
	| { readonly slot: "selection" }
	/** 슬래시 메뉴·빈 문서. 결과(MDX)는 커서 자리에 넣는다. */
	| { readonly slot: "insert" }
	/** 본문 블록 하나의 손잡이 옆(`block`은 블록 이름, 예: `mermaid`). 결과(MDX)는 바뀐 곳을 보여 준 뒤 그 블록을 바꾼다. */
	| { readonly slot: "block"; readonly block: string };

type RequiredInputNames<I> = { [K in keyof I]: I[K] extends { readonly required: true } ? K : never }[keyof I];
/** 필수 입력을 모두 채울 수 있는 자리. */
type AttachableSlot<I> = {
	[S in AiSlot]: [Exclude<RequiredInputNames<I>, SlotInputNames[S]>] extends [never] ? S : never;
}[AiSlot];

// ---------------------------------------------------------------------------
// 선택지
// ---------------------------------------------------------------------------

/**
 * 판단 방식의 선택지와 `있는 값만` 검사·후보 이름에 쓰는 목록. 서버가 직접 읽는다.
 * - `collection`: 그 컬렉션의 공개된 항목(값은 항목 ID, 이름은 제목)
 * - `select`: 선택 필드의 선택지
 * - `list`: 직접 적은 목록
 */
export type AiChoices =
	| { readonly from: "collection"; readonly collection: string }
	| { readonly from: "select"; readonly collection: string; readonly field: string }
	| { readonly from: "list"; readonly items: readonly string[] };

// ---------------------------------------------------------------------------
// 기능 정의
// ---------------------------------------------------------------------------

/**
 * 코드 검사가 서버에서 읽는 본체 콘텐츠 조회. 실행 API가 본체의 공개 조회(`@monti-cms/core/plugin/server`의
 * `createContentLookup`)로 채운다. 플러그인은 본체 표를 직접 읽지 않는다.
 */
export interface AiContentLookup {
	/** 주소(slug) 중 같은 컬렉션·언어에서 이미 쓰는 것. `excludeEntryId` 항목이 쓰는 주소는 뺀다. */
	slugsInUse(params: {
		readonly collection: string;
		readonly locale: string;
		readonly slugs: readonly string[];
		readonly excludeEntryId?: string;
	}): Promise<ReadonlySet<string>>;
}

/** 코드 검사가 받는 상황. */
export interface AiValidatorContext {
	/** 실행에 쓴 입력. */
	readonly input: Readonly<Record<string, unknown>>;
	readonly collection?: string;
	/** 콘텐츠 언어. 요청에 없으면 사이트 설정의 기본 언어다. */
	readonly locale: string;
	readonly entryId?: string;
	/** 선택지가 있는 기능이면 값 → 보이는 이름. */
	readonly choices?: ReadonlyMap<string, string>;
	/** 본체 콘텐츠 조회(서버). */
	readonly content: AiContentLookup;
}

/**
 * 코드 검사의 결과. `true`·`null`·`undefined`면 통과, `false`면 버리고, 글자면 그 이유로 버린다.
 * 통과시키면서 후보 옆에 설명을 붙이려면 `{ detail }`.
 */
export type AiValidatorResult = boolean | string | null | undefined | { readonly detail: string };

/**
 * 코드 검사(`defineValidator`). 정해진 검사(형식·길이·선택지)로 안 되는 것을 함수로 본다. 기능의 `checks`에 넣으면
 * 관리자 화면에 이름이 보이고 켜고 끌 수 있다(값은 고칠 수 없다). 서버에서 값 하나(후보 하나, 또는 글·MDX 결과 전체)마다 부른다.
 */
export interface AiValidator {
	readonly kind: "code";
	/** 기능 안에서 겹치지 않는 이름(소문자·숫자·하이픈). 고친 값(켜기)이 이 이름으로 남는다. */
	readonly name: string;
	/** 관리자 화면에 보이는 이름. */
	readonly label: string;
	/** 처음에 켜 둘까. 없으면 켠다. */
	readonly enabled?: boolean;
	readonly run: (value: string, context: AiValidatorContext) => AiValidatorResult | Promise<AiValidatorResult>;
}

/** 코드 검사를 만든다. 기능 정의의 `checks`에 정해진 검사와 함께 넣는다. */
// `label`을 읽을 때마다 지금 화면 언어로 고르는 접근자(`get label()`)를 값으로 굳히지 않으려고 속성 설명자째 옮긴다.
export const defineValidator = (check: Omit<AiValidator, "kind">): AiValidator =>
	Object.defineProperties({ kind: "code" }, Object.getOwnPropertyDescriptors(check)) as AiValidator;

const isValidator = (check: AiCheckInput | AiValidator): check is AiValidator => "run" in check;

export interface AiActionDefinition<I extends AiInputs = AiInputs> {
	/** 관리자 화면과 버튼에 보이는 이름. */
	readonly label: string;
	readonly input: I;
	/** 처음에 보낼 입력. 없으면 전부. 관리자 화면에서 켜고 끈다. */
	readonly send?: readonly (keyof I & string)[];
	/** 지시문. 판단 방식에서는 판단 기준이다. `{{언어 입력 이름}}`은 언어 이름으로 바뀐다. */
	readonly prompt: string;
	readonly result: AiResult;
	/** 적용 방식. 없으면 메모는 `none`, 나머지는 `replace`. */
	readonly apply?: AiApply;
	/** 없으면 `generate`. `decide`는 `choices`가 있어야 한다. */
	readonly engine?: AiEngine;
	readonly choices?: AiChoices;
	/** 판단 방식에서 하나만 고르나. 없으면 `many`. */
	readonly pick?: AiPick;
	/** 판단 방식의 기준 확률(0~1). 없으면 0.6. */
	readonly threshold?: number;
	/** 판단 방식 후보 최대 개수. 없으면 5. */
	readonly maxCount?: number;
	/**
	 * 결과 검사. 정해진 검사를 먼저, 코드 검사(`defineValidator`)를 그다음에 적힌 순서대로 적용한다.
	 * 관리자 화면에서는 켜기·값을 고치고, 형식·길이·선택지 안 검사를 더한다.
	 */
	readonly checks?: readonly (Exclude<AiCheckInput, { kind: "code" }> | AiValidator)[];
	/** 실행할 때 추가 요청을 받는다. 없으면 받지 않는다. */
	readonly askInstruction?: boolean;
	/** 누르면 결과를 보여 주지 않고 바로 넣는다(후보는 맨 앞 후보). 없으면 결과를 보이고 눌러서 넣는다. */
	readonly instant?: boolean;
	/** 결과를 흘려받는다(조금씩 보인다). 생성 방식의 글·MDX 결과만. */
	readonly stream?: boolean;
	/** 처음에 켜 둘까. 없으면 켠다. */
	readonly enabled?: boolean;
	readonly attach?: readonly AiAttach[];
	/**
	 * 개발 전용 가짜 연결(`CMS_AI_FAKE=1`)이 이 기능의 답으로 쓸 글. 받은 입력(이름 → 글)으로 만든다. 없으면 가짜 연결이
	 * 결과 모양과 입력 종류로 답을 만든다. 코드 검사가 정해진 모양(예: 다이어그램 문법)을 바라는 기능만 둔다.
	 * 후보 결과면 줄마다 후보 하나다.
	 */
	readonly fake?: (input: Readonly<Record<string, string>>) => string;
}

/** 공통 문구 하나(예: 문체 가이드). 지시문에 `{{shared.이름}}`으로 넣고, 관리자 AI 화면에서 고친다. */
export interface AiSharedText {
	readonly label: string;
	/** 기본 문구. 관리자 화면에서 고친 값이 있으면 그것을 쓴다. */
	readonly text: string;
}

/** 기능을 만드는 함수가 보는 사이트 설정. */
export interface AiSiteView {
	readonly collections: CollectionsConfig;
	/** 사이트가 쓰는 본문 블록 정의(본체 + 확장 + 사이트). */
	readonly blocks: readonly BlockDefinition[];
	readonly locales: readonly { readonly code: string }[];
	/** AI 설정의 공통 문구 이름(`aiPlugin({ shared })`). */
	readonly sharedKeys: readonly string[];
}

/**
 * 사이트 설정을 보고 기능 하나를 만드는 함수. 기본 기능(`aiPresets`)과 확장이 더하는 기능이 이 모양이다(필드 종류·역할·관계
 * 대상으로 붙을 필드를 찾는다). 붙을 곳이 없으면 `undefined`이고 그 기능은 켜지지 않는다.
 */
export type AiActionFactory<D extends AiActionDefinition = AiActionDefinition> = (site: AiSiteView) => D | undefined;

/** 기능 정의 또는 기능을 만드는 함수. */
export type AiActionSource = AiActionDefinition | AiActionFactory;

/**
 * 다른 플러그인이 AI 기능을 더하는 모양. 플러그인 정의의 `contributes: { ai: { actions } }`에 둔다(AI 플러그인이 없으면
 * 쓰이지 않는다). 예: 블록 확장의 다이어그램 만들기, SEO 확장의 검색 제목 추천.
 */
export interface AiContribution {
	readonly actions?: Readonly<Record<string, AiActionSource>>;
}

export interface AiConfig {
	/** 사이트 소개. 모든 기능의 맨 앞 지시("너는 {이것} CMS의 편집 보조 도구다")에 들어간다. 없으면 "웹사이트". */
	readonly siteDescription?: string;
	/**
	 * 여러 기능이 함께 쓰는 공통 문구. 지시문에 `{{shared.이름}}`으로 넣는다. `styleGuide`가 있으면 기본 기능인 문체
	 * 다듬기·초안 쓰기 지시문에 들어간다.
	 */
	readonly shared?: Readonly<Record<string, AiSharedText>>;
	/**
	 * 바꾸거나 더할 기능. 기본 기능(`aiPresets`, 사이트에 붙을 곳이 있는 것)과 다른 플러그인이 더한 기능은 적지 않아도 켜진다.
	 * 같은 이름에 정의(또는 `aiPresets.이름(옵션)`)를 주면 그것으로 바꾸고, `false`를 주면 뺀다. 새 이름이면 더한다.
	 */
	readonly actions?: Readonly<Record<string, AiActionSource | false>>;
}

/** 설정을 풀어 낸 기능 목록(이름 → 정의). 실행기·화면·검사가 읽는다. */
export interface ResolvedAiConfig {
	readonly shared?: Readonly<Record<string, AiSharedText>>;
	readonly actions: Readonly<Record<string, AiActionDefinition>>;
}

/** 지시문의 `{{이름}}`. */
type Placeholders<S extends string> = S extends `${string}{{${infer P}}}${infer Rest}` ? P | Placeholders<Rest> : never;
type LocaleInputNames<I> = { [K in keyof I]: I[K] extends { readonly kind: "locale" } ? K : never }[keyof I];
/** 지시문에 언어 입력·공통 문구(`shared.이름`)가 아닌 `{{이름}}`이 있으면 타입 오류를 낸다. 공통 문구 이름은 플러그인 설정이 확인한다. */
type PromptCheck<P extends string, I> = string extends P
	? unknown
	: [Exclude<Placeholders<P>, LocaleInputNames<I> | `shared.${string}`>] extends [never]
		? unknown
		: {
				readonly "The prompt can only use locale inputs and shared texts as {{name}}": Exclude<
					Placeholders<P>,
					LocaleInputNames<I> | `shared.${string}`
				>;
			};

/**
 * 기능을 정의한다. 지시문의 `{{이름}}`과 붙을 곳(자리가 입력을 모두 채울 수 있는지)을 타입으로 확인한다.
 */
export function aiAction<
	const I extends AiInputs,
	const P extends string,
	const D extends Omit<AiActionDefinition<I>, "input" | "prompt" | "attach"> & {
		readonly attach?: readonly Extract<AiAttach, { readonly slot: AttachableSlot<I> }>[];
	},
>(definition: D & { readonly input: I; readonly prompt: P & PromptCheck<P, I> }): D & { input: I; prompt: P } {
	return definition;
}

/** 기능의 결과 타입. */
export type AiActionResult<D> = D extends { readonly result: "candidates" }
	? { kind: "candidates"; items: AiCandidate[] }
	: D extends { readonly result: "text" }
		? { kind: "text"; text: string }
		: D extends { readonly result: "mdx" }
			? { kind: "mdx"; text: string }
			: D extends { readonly result: "note" }
				? { kind: "note"; text: string }
				: never;

type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** 기능을 부를 때 줄 입력의 타입. `required` 입력만 꼭 줘야 한다. */
export type AiActionInput<D> = D extends { readonly input: infer I }
	? Simplify<
			{
				-readonly [K in keyof I as I[K] extends { readonly required: true } ? K : never]: AiInputValue<I[K]>;
			} & {
				-readonly [K in keyof I as I[K] extends { readonly required: true } ? never : K]?: AiInputValue<I[K]>;
			}
		>
	: never;

// ---------------------------------------------------------------------------
// 고친 값과 실행할 정의
// ---------------------------------------------------------------------------

/** 관리자 화면에서 고칠 수 있는 값. DB에는 정의와 다른 것만 둔다. */
export const aiActionOverrideSchema = z
	.object({
		enabled: z.boolean(),
		askInstruction: z.boolean(),
		instant: z.boolean(),
		/** 쓸 연결의 id. `null`이면 방식에 맞는 첫 연결. */
		providerId: z.string().max(60).nullable(),
		/** 쓸 모델 이름. 빈 글자면 연결의 기본 모델. */
		modelName: z.string().trim().max(200),
		prompt: z.string().trim().min(1).max(MAX_PROMPT_LENGTH),
		send: z.array(z.string().max(40)).max(20),
		threshold: z.number().min(0.01).max(0.99),
		maxCount: z.number().int().min(1).max(20),
		checks: z.array(z.preprocess(migrateCheck, aiCheckSchema)).max(10),
	})
	.partial();
export type AiActionOverride = z.output<typeof aiActionOverrideSchema>;

/** 정의에 고친 값을 얹은, 실행할 기능. */
export interface ResolvedAiAction {
	readonly key: string;
	readonly label: string;
	readonly input: AiInputs;
	readonly send: readonly string[];
	readonly prompt: string;
	readonly result: AiResult;
	readonly apply: AiApply;
	readonly engine: AiEngine;
	readonly choices?: AiChoices;
	readonly pick: AiPick;
	readonly threshold: number;
	readonly maxCount: number;
	readonly checks: readonly AiCheck[];
	/** 기능 정의가 정한 검사(`checkKey`). 관리자 화면은 이것을 끌 수만 있고, 나머지(사용자가 더한 검사)는 뺄 수 있다. */
	readonly definedChecks: readonly string[];
	/** 코드 검사 이름 → 검사. `checks`의 `{ kind: "code" }` 항목이 가리킨다. */
	readonly validators: Readonly<Record<string, AiValidator>>;
	readonly askInstruction: boolean;
	readonly instant: boolean;
	readonly stream: boolean;
	readonly enabled: boolean;
	readonly providerId: string | null;
	readonly modelName: string;
	readonly attach: readonly AiAttach[];
	/** 가짜 연결이 쓸 답(`AiActionDefinition.fake`). */
	readonly fake?: (input: Readonly<Record<string, string>>) => string;
}

/** 고칠 수 있는 값 이름. */
export const EDITABLE_KEYS = [
	"enabled",
	"askInstruction",
	"instant",
	"providerId",
	"modelName",
	"prompt",
	"send",
	"threshold",
	"maxCount",
	"checks",
] as const satisfies readonly (keyof AiActionOverride & keyof ResolvedAiAction)[];

export type AiActionEditable = Pick<ResolvedAiAction, (typeof EDITABLE_KEYS)[number]>;

const defaultChecks = (definition: AiActionDefinition): AiCheck[] =>
	(definition.checks ?? []).map((check) =>
		isValidator(check)
			? { kind: "code", name: check.name, enabled: check.enabled ?? true }
			: aiCheckSchema.parse(check),
	);

/**
 * 정의에 고친 값을 얹는다. 검사는 정의에 있는 종류를 정의의 순서대로 두고 사용자가 고친 켜기·값을 얹은 뒤, 사용자가
 * 더한 검사(형식·길이·선택지 안, 종류마다 하나)를 뒤에 붙인다.
 * 보낼 입력은 정의에 있는 이름만 남기고, 필수 입력은 언제나 보낸다.
 */
export function resolveAction(
	key: string,
	definition: AiActionDefinition,
	override: AiActionOverride = {},
): ResolvedAiAction {
	const inputNames = Object.keys(definition.input);
	const base = defaultChecks(definition);
	const required = inputNames.filter((name) => definition.input[name]?.required);
	const chosen = override.send ?? definition.send ?? inputNames;
	const send = inputNames.filter((name) => chosen.includes(name) || required.includes(name));
	return {
		key,
		label: definition.label,
		input: definition.input,
		send,
		prompt: override.prompt ?? definition.prompt,
		result: definition.result,
		apply: definition.apply ?? (definition.result === "note" ? "none" : "replace"),
		engine: definition.engine ?? "generate",
		...(definition.choices ? { choices: definition.choices } : {}),
		pick: definition.pick ?? "many",
		threshold: override.threshold ?? definition.threshold ?? 0.6,
		maxCount: override.maxCount ?? definition.maxCount ?? 5,
		checks: [
			...base.map((check) => {
				const mine = override.checks?.find((item) => checkKey(item) === checkKey(check));
				return mine ? ({ ...check, ...mine } as AiCheck) : check;
			}),
			...(override.checks ?? []).filter(
				(check, index, all) =>
					isAddableCheck(check.kind) &&
					!base.some((item) => item.kind === check.kind) &&
					all.findIndex((item) => item.kind === check.kind) === index,
			),
		],
		definedChecks: base.map(checkKey),
		validators: Object.fromEntries((definition.checks ?? []).filter(isValidator).map((check) => [check.name, check])),
		askInstruction: override.askInstruction ?? definition.askInstruction ?? false,
		instant: override.instant ?? definition.instant ?? false,
		stream: definition.stream ?? false,
		enabled: override.enabled ?? definition.enabled ?? true,
		providerId: override.providerId ?? null,
		modelName: override.modelName ?? "",
		attach: definition.attach ?? [],
		...(definition.fake ? { fake: definition.fake } : {}),
	};
}

/** 고친 값 중 정의(기본값)와 다른 것만 남긴다. DB에 저장할 모양이다. */
export function overrideFrom(definition: AiActionDefinition, edited: Partial<AiActionEditable>): AiActionOverride {
	const base = resolveAction("", definition);
	const override: Record<string, unknown> = {};
	for (const key of EDITABLE_KEYS) {
		const value = edited[key];
		if (value === undefined) continue;
		if (JSON.stringify(value) !== JSON.stringify(base[key])) override[key] = value;
	}
	return aiActionOverrideSchema.parse(override);
}

// ---------------------------------------------------------------------------
// 지시문
// ---------------------------------------------------------------------------

const PLACEHOLDER = /\{\{\s*((?:shared\.)?[A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;
const SHARED_PREFIX = "shared.";

/**
 * 지시문의 `{{이름}}` 중 언어 입력도, 있는 공통 문구(`shared.이름`)도 아닌 것. 정의 확인과 저장 전 확인에 쓴다.
 */
export function unknownPlaceholders(prompt: string, input: AiInputs, sharedKeys: readonly string[] = []): string[] {
	const names = [...prompt.matchAll(PLACEHOLDER)].map((match) => match[1] ?? "");
	return [
		...new Set(
			names.filter((name) =>
				name.startsWith(SHARED_PREFIX)
					? !sharedKeys.includes(name.slice(SHARED_PREFIX.length))
					: input[name]?.kind !== "locale",
			),
		),
	];
}

/**
 * 실행할 지시문. `{{언어 입력}}`을 언어 이름으로, `{{shared.이름}}`을 공통 문구로 바꾸고, 지시문에 쓰지 않은 언어 입력은
 * `이름: 언어` 줄로 붙인다. 마지막에 실행할 때 적은 추가 요청을 붙인다(`요청 받기`가 켜진 기능만).
 */
export function renderPrompt(
	action: Pick<ResolvedAiAction, "prompt" | "input" | "askInstruction">,
	values: Readonly<Record<string, unknown>>,
	languageName: (code: string) => string,
	request?: string,
	shared: Readonly<Record<string, string>> = {},
): string {
	const used = new Set<string>();
	const prompt = action.prompt.replace(PLACEHOLDER, (whole, name: string) => {
		if (name.startsWith(SHARED_PREFIX)) {
			const text = shared[name.slice(SHARED_PREFIX.length)];
			return text === undefined ? whole : text.trim() || "(none)";
		}
		const value = values[name];
		if (action.input[name]?.kind !== "locale" || typeof value !== "string") return whole;
		used.add(name);
		return languageName(value);
	});
	const lines = Object.entries(action.input)
		.filter(([name, spec]) => spec.kind === "locale" && !used.has(name) && typeof values[name] === "string")
		.map(([name]) => `${name}: ${languageName(values[name] as string)}`);
	const extra = action.askInstruction ? request?.trim() : "";
	return [
		prompt,
		...lines,
		...(extra ? [`Request for this run (takes priority over the instructions above):\n${extra}`] : []),
	].join("\n\n");
}

// ---------------------------------------------------------------------------
// 요청 검사
// ---------------------------------------------------------------------------

const imageValueSchema = z
	.object({ mediaId: z.uuid().optional(), src: z.string().max(2000).optional() })
	.refine((value) => Boolean(value.mediaId || value.src), { error: () => t("image.missing") });

function inputValueSchema(spec: AiInputSpec): z.ZodType {
	switch (spec.kind) {
		case "image":
			return imageValueSchema;
		case "value":
			return z.union([z.string().max(10_000), z.array(z.string().max(200)).max(200)]);
		case "locale":
			return z.string().min(1).max(10);
		default:
			return z.string().max(INPUT_LIMITS[spec.kind]);
	}
}

/** 기능 입력의 검사. 정의에 없는 이름은 버린다. */
export function inputSchemaFor(input: AiInputs) {
	return z.object(
		Object.fromEntries(
			Object.entries(input).map(([name, spec]) => {
				const schema = inputValueSchema(spec);
				return [name, spec.required ? schema : schema.optional()];
			}),
		),
	);
}

/** 실행 요청의 공통 정보(입력 밖). */
export const aiRunEnvSchema = z.object({
	collection: z.string().max(40).optional(),
	locale: z.string().max(10).optional(),
	entryId: z.uuid().optional(),
	/** `code` 입력의 언어(코드 블록). */
	language: z.string().max(40).optional(),
});
export type AiRunEnv = z.output<typeof aiRunEnvSchema>;

/** 한 요청에 묶어 보내는 입력 수(번역의 `모두 번역` 등). */
export const MAX_BATCH_INPUTS = 8;

export const aiRunBodySchema = z
	.object({
		action: z.string().min(1).max(60),
		/** 입력 하나. */
		input: z.record(z.string(), z.unknown()).optional(),
		/** 같은 기능을 여러 입력에 돌린다. 결과는 입력 순서대로 하나씩(실패도 하나씩) 돌려준다. */
		inputs: z.array(z.record(z.string(), z.unknown())).min(1).max(MAX_BATCH_INPUTS).optional(),
		env: aiRunEnvSchema.default({}),
		/** 실행할 때 적은 추가 요청. 기능이 `askInstruction`일 때만 지시문에 붙는다. */
		request: z.string().max(MAX_REQUEST_LENGTH).optional(),
		/** 저장하지 않은 고친 값으로 시험한다(AI 화면의 `시험`). */
		draft: z.unknown().optional(),
		/** 화면 기능의 저장하지 않은 기본 정보(새 기능을 저장 전에 시험할 때). `draft`와 함께 보낸다. */
		draftBase: z.unknown().optional(),
		/** 결과를 흘려받는다(`application/x-ndjson`). 흘려받기 기능의 입력 하나만. */
		stream: z.boolean().optional(),
	})
	.refine((body) => (body.input === undefined) !== (body.inputs === undefined), {
		error: () => t("run.inputOrInputs"),
	});
export type AiRunBody = z.output<typeof aiRunBodySchema>;

// ---------------------------------------------------------------------------
// 설정 확인
// ---------------------------------------------------------------------------

/** 설정의 컬렉션 정의 중 확인에 필요한 부분. */
interface CollectionsView {
	readonly [name: string]: {
		readonly fields: Readonly<
			Record<string, { readonly kind: string; readonly discriminant?: { readonly kind: string } }>
		>;
	};
}

const NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

/** 필드 이름으로 그 컬렉션의 필드 정의를 찾는다(조건부 필드에 딸린 필드도). */
function findField(
	collections: CollectionsView,
	collection: string,
	field: string,
): { readonly kind: string } | undefined {
	const fields = collections[collection]?.fields;
	if (!fields) return undefined;
	if (fields[field]) return fields[field];
	for (const definition of Object.values(fields)) {
		const values = (definition as { values?: Record<string, Record<string, { kind: string }> | undefined> }).values;
		for (const group of Object.values(values ?? {})) if (group?.[field]) return group[field];
	}
	return undefined;
}

/** AI 설정이 컬렉션 정의·자리·결과 모양과 맞는지 확인한다. 틀리면 앱이 뜰 때 바로 알린다. */
export function validateAiConfig(ai: ResolvedAiConfig, collections: CollectionsView, blocks?: readonly string[]): void {
	const sharedKeys = Object.keys(ai.shared ?? {});
	for (const key of sharedKeys) {
		if (!NAME.test(key)) throw new Error(`cms.config: ai.shared.${key}: name must be letters, digits or _`);
	}
	for (const [key, action] of Object.entries(ai.actions)) {
		const where = `cms.config: ai.actions.${key}`;
		if (!NAME.test(key)) throw new Error(`${where}: name must be letters, digits or _`);
		const inputs = Object.entries(action.input);
		for (const [name] of inputs) if (!NAME.test(name)) throw new Error(`${where}: bad input name "${name}"`);
		for (const name of action.send ?? []) {
			if (!action.input[name]) throw new Error(`${where}: send lists unknown input "${name}"`);
		}
		const unknown = unknownPlaceholders(action.prompt, action.input, sharedKeys);
		if (unknown.length > 0) {
			throw new Error(`${where}: prompt can only use locale inputs and shared texts, not {{${unknown[0]}}}`);
		}

		const choices = action.choices;
		if (choices?.from === "collection" && !collections[choices.collection]) {
			throw new Error(`${where}: choices use unknown collection "${choices.collection}"`);
		}
		if (choices?.from === "select") {
			const field = findField(collections, choices.collection, choices.field);
			const select =
				field?.kind === "conditional" ? (field as { discriminant?: { kind: string } }).discriminant : field;
			if (select?.kind !== "select") {
				throw new Error(`${where}: choices need a select field ${choices.collection}.${choices.field}`);
			}
		}
		const engine = action.engine ?? "generate";
		if (engine === "decide") {
			if (!choices) throw new Error(`${where}: decide engine needs choices`);
			if (action.result !== "candidates") throw new Error(`${where}: decide engine answers candidates only`);
			if (inputs.some(([, spec]) => spec.kind === "image"))
				throw new Error(`${where}: decide engine cannot read images`);
		}
		if (action.stream && (engine !== "generate" || (action.result !== "text" && action.result !== "mdx"))) {
			throw new Error(`${where}: stream needs the generate engine and a text or mdx result`);
		}
		if (action.fake !== undefined && typeof action.fake !== "function") {
			throw new Error(`${where}: fake must be a function`);
		}
		if (action.result === "note" && action.apply && action.apply !== "none") {
			throw new Error(`${where}: note results are not applied`);
		}
		const codeNames = new Set<string>();
		for (const check of action.checks ?? []) {
			if (check.kind === "exists" && !choices) throw new Error(`${where}: exists check needs choices`);
			if (isValidator(check)) {
				if (!CODE_CHECK_NAME.test(check.name))
					throw new Error(`${where}: check name "${check.name}" must be kebab-case`);
				if (codeNames.has(check.name)) throw new Error(`${where}: check "${check.name}" is listed twice`);
				if (typeof check.run !== "function") throw new Error(`${where}: check "${check.name}" needs a run function`);
				codeNames.add(check.name);
			}
		}

		for (const attach of action.attach ?? []) {
			const provides: Readonly<Record<string, AiInputKind>> = SLOT_INPUTS[attach.slot];
			for (const [name, spec] of inputs) {
				const given = provides[name];
				if (given === undefined ? spec.required : given !== spec.kind) {
					throw new Error(`${where}: ${attach.slot} slot cannot fill input "${name}" (${spec.kind})`);
				}
			}
			if (attach.slot === "block") {
				if (action.result !== "mdx") throw new Error(`${where}: block slot needs an mdx result`);
				if (blocks && !blocks.includes(attach.block)) {
					throw new Error(`${where}: attach uses unknown block "${attach.block}"`);
				}
				continue;
			}
			if (attach.slot !== "field") continue;
			for (const collection of attach.collections ?? []) {
				if (!collections[collection]) throw new Error(`${where}: attach uses unknown collection "${collection}"`);
				if (!findField(collections, collection, attach.field)) {
					throw new Error(`${where}: ${collection} has no field "${attach.field}"`);
				}
			}
			if (!Object.keys(collections).some((collection) => findField(collections, collection, attach.field))) {
				throw new Error(`${where}: attach uses unknown field "${attach.field}"`);
			}
		}
	}
}
