// AI 플러그인은 고를 수 있는 의존성이라 타입만 읽는다(블록 확장은 AI 플러그인 코드를 불러오지 않는다).

import type { AiActionDefinition, AiContribution } from "@monti-cms/ai";
import { createActiveTranslator } from "@monti-cms/core";
import { mermaidMessages } from "./messages";

/**
 * Mermaid 블록의 AI 기능(`@monti-cms/ai`를 쓰는 사이트만). `mermaid()` 플러그인이 `contributes.ai`로 더하므로 AI 플러그인을
 * 쓰는 사이트에는 저절로 붙는다(`diagramDraft`·`diagramEdit`). 지시문을 바꾸려면 같은 이름으로 적고, 끄려면 `false`를 준다.
 *
 * ```ts
 * aiPlugin({ actions: { diagramDraft: mermaidAi.draft({ prompt: "…" }), diagramEdit: false } })
 * ```
 */

// 사이트 설정 파일이 읽는 모듈이라 화면 언어는 글자를 읽는 때에 고른다.
const t = createActiveTranslator(mermaidMessages);

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

/** Mermaid가 아는 다이어그램 종류(첫 줄의 첫 낱말). */
const DIAGRAM_TYPES = new Set([
	"graph",
	"flowchart",
	"sequenceDiagram",
	"classDiagram",
	"stateDiagram",
	"stateDiagram-v2",
	"erDiagram",
	"journey",
	"gantt",
	"pie",
	"quadrantChart",
	"requirementDiagram",
	"gitGraph",
	"C4Context",
	"C4Container",
	"C4Component",
	"C4Dynamic",
	"C4Deployment",
	"mindmap",
	"timeline",
	"sankey-beta",
	"xychart-beta",
	"block-beta",
	"packet-beta",
	"architecture-beta",
	"kanban",
]);

/**
 * 코드 검사: 답이 ```mermaid 코드 펜스 하나이고, 첫 줄이 Mermaid가 아는 다이어그램 종류인가.
 * 그림을 실제로 그려 보는 검사는 브라우저(미리보기)가 한다.
 */
export function validateMermaid(value: string): string | undefined {
	const match = value.trim().match(/^```mermaid[^\n]*\n([\s\S]*?)\n?```$/);
	if (!match) return t("ai.error.notFence");
	const first = (match[1] ?? "")
		.split("\n")
		.map((line) => line.trim())
		.find((line) => line && !line.startsWith("%%"));
	if (!first) return t("ai.error.empty");
	const type = first.split(/\s+/)[0] ?? "";
	return DIAGRAM_TYPES.has(type) ? undefined : t("ai.error.unknownType", { type });
}

/** 결과 문법 검사(코드 검사). 다른 기능에도 `checks`로 넣을 수 있다. */
export const mermaidSyntax = codeCheck({
	name: "mermaid-syntax",
	get label() {
		return t("ai.check.label");
	},
	run: validateMermaid,
});

/** 가짜 연결(개발 전용)의 답: 문법 검사를 통과하는 다이어그램. 고칠 다이어그램이 있으면 노드 한 줄을 더한다. */
function fakeMermaid(input: Readonly<Record<string, string>>): string {
	const fence = input.block?.trim().match(/^(```mermaid[^\n]*\n[\s\S]*?)\n?(```)$/);
	if (fence) return `${fence[1]}\n  fake["(fake)"]\n${fence[2]}`;
	const title = (input.title?.trim() || t("ai.fake.title")).replaceAll('"', "'");
	return `\`\`\`mermaid\ngraph TD\n  fake["(fake) ${title}"]\n\`\`\``;
}

export const mermaidAi = {
	/** 다이어그램 만들기. 슬래시 메뉴에서 요청을 받아 커서 자리에 Mermaid 블록을 넣는다. */
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
				return options.prompt ?? t("ai.draft.prompt");
			},
			checks: [mermaidSyntax],
			fake: fakeMermaid,
			attach: [{ slot: "insert" }],
		}) as const satisfies AiActionDefinition,

	/** 다이어그램 고치기. 블록 손잡이 옆에서 요청대로 고치고, 바뀐 곳을 보인 뒤 블록을 바꾼다. */
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
				return options.prompt ?? t("ai.edit.prompt");
			},
			checks: [mermaidSyntax],
			fake: fakeMermaid,
			attach: [{ slot: "block", block: "mermaid" }],
		}) as const satisfies AiActionDefinition,
};

/** `mermaid()`이 AI 플러그인에 더하는 것. 기능 이름은 관리자 AI 화면에서 고친 값의 키다. */
export const mermaidAiContribution = {
	actions: { diagramDraft: mermaidAi.draft(), diagramEdit: mermaidAi.edit() },
} satisfies AiContribution;
