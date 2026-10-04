// AI 플러그인은 고를 수 있는 의존성이라 타입만 읽는다(블록 확장은 AI 플러그인 코드를 불러오지 않는다).

import type { AiActionDefinition, AiContribution } from "@monti-cms/ai";
import { createActiveTranslator } from "@monti-cms/core";
import { normalizeChartDsl, parseChartDsl } from "./dsl";
import { chartMessages } from "./messages";

/**
 * 차트 블록의 AI 기능(`@monti-cms/ai`를 쓰는 사이트만). `chart()` 플러그인이 `contributes.ai`로 더하므로 AI 플러그인을
 * 쓰는 사이트에는 저절로 붙는다(`chartDraft`·`chartEdit`). 지시문을 바꾸려면 같은 이름으로 적고, 끄려면 `false`를 준다.
 *
 * ```ts
 * aiPlugin({ actions: { chartDraft: chartAi.draft({ prompt: "…" }), chartEdit: false } })
 * ```
 */

// 사이트 설정 파일이 읽는 모듈이라 화면 언어는 글자를 읽는 때에 고른다.
const t = createActiveTranslator(chartMessages);

const lines = (...text: string[]) => text.join("\n");

/**
 * 코드 검사(`@monti-cms/ai`의 `AiValidator`·`defineValidator`와 같은 모양). 모양을 여기 적어 배포 타입 선언이 AI 플러그인을
 * 가리키지 않게 한다(AI 플러그인이 없는 사이트도 타입 검사를 통과한다). 맞는 모양인지는 아래 `satisfies`가 확인한다.
 */
export interface CodeCheck {
	readonly kind: "code";
	readonly name: string;
	readonly label: string;
	readonly run: (value: string) => string | undefined;
}
/** `label`이 글자를 읽는 때에 고르는 getter라 복사하지 않고 속성 정의째 합친다. */
const codeCheck = (check: Omit<CodeCheck, "kind">): CodeCheck =>
	Object.defineProperties({ kind: "code" as const }, Object.getOwnPropertyDescriptors(check)) as CodeCheck;

/** 차트 문법(`parseChartDsl`) 설명. 지시문에 넣는다. */
export const chartSyntaxGuide = (): string => t("ai.guide");

/** 코드 검사: 답이 ```chart 코드 펜스 하나이고 차트 문법(`parseChartDsl`·`normalizeChartDsl`)에 맞는가. */
export function validateChart(value: string): string | undefined {
	const match = value.trim().match(/^```chart[^\n]*\n([\s\S]*?)\n?```$/);
	if (!match) return t("ai.error.notFence");
	const { errors } = normalizeChartDsl(parseChartDsl(match[1] ?? ""));
	const [first] = errors;
	return first
		? t("ai.error.syntax", { line: first.line, message: t(`error.${first.code}`, first.values) })
		: undefined;
}

/** 결과 문법 검사(코드 검사). 다른 기능에도 `checks`로 넣을 수 있다. */
export const chartSyntax = codeCheck({
	name: "chart-syntax",
	get label() {
		return t("ai.check.label");
	},
	run: validateChart,
});

/** 가짜 연결(개발 전용)의 답: 문법 검사를 통과하는 차트. 고칠 차트가 있으면 마지막 값 행을 한 번 더 넣는다. */
function fakeChart(input: Readonly<Record<string, string>>): string {
	const fence = input.block?.trim().match(/^(```chart[^\n]*\n[\s\S]*?)\n?(```)$/);
	if (fence) {
		const body = fence[1] ?? "";
		return `${body}\n${body.trimEnd().split("\n").at(-1) ?? ""}\n${fence[2]}`;
	}
	const label = (input.title?.trim() || "(fake)").replaceAll("|", " ");
	return lines(
		"```chart",
		"chart bar",
		"x label",
		"series value | (fake) | chart-1",
		"",
		"data",
		"label | value",
		`${label} | 1`,
		"```",
	);
}

export const chartAi = {
	/** 차트 만들기. 슬래시 메뉴에서 요청을 받아 커서 자리에 차트 블록을 넣는다. */
	draft: (options: { readonly prompt?: string } = {}) =>
		({
			get label() {
				return t("ai.draft.label");
			},
			input: {
				title: {
					kind: "text",
					get label() {
						return t("ai.input.title");
					},
				},
				body: {
					kind: "mdx",
					get label() {
						return t("ai.input.body");
					},
				},
			},
			result: "mdx",
			stream: true,
			askInstruction: true,
			get prompt() {
				return options.prompt ?? lines(t("ai.draft.prompt"), "", chartSyntaxGuide());
			},
			checks: [chartSyntax],
			fake: fakeChart,
			attach: [{ slot: "insert" }],
		}) as const satisfies AiActionDefinition,

	/** 차트 고치기. 블록 손잡이 옆에서 요청대로 고치고, 바뀐 곳을 보인 뒤 블록을 바꾼다. */
	edit: (options: { readonly prompt?: string } = {}) =>
		({
			get label() {
				return t("ai.edit.label");
			},
			input: {
				block: {
					kind: "mdx",
					get label() {
						return t("ai.input.block");
					},
					required: true,
				},
				title: {
					kind: "text",
					get label() {
						return t("ai.input.title");
					},
				},
			},
			result: "mdx",
			stream: true,
			askInstruction: true,
			get prompt() {
				return options.prompt ?? lines(t("ai.edit.prompt"), "", chartSyntaxGuide());
			},
			checks: [chartSyntax],
			fake: fakeChart,
			attach: [{ slot: "block", block: "chart" }],
		}) as const satisfies AiActionDefinition,
};

/** `chart()`이 AI 플러그인에 더하는 것. 기능 이름은 관리자 AI 화면에서 고친 값의 키다. */
export const chartAiContribution = {
	actions: { chartDraft: chartAi.draft(), chartEdit: chartAi.edit() },
} satisfies AiContribution;
