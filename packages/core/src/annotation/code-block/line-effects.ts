import { createActiveTranslator } from "../../i18n/active";
import { codeBlockMessages } from "./messages";

/**
 * 코드 블록 줄 효과 정의(`// @line 이름 {2-4}`). 본체 기본(강조·추가·삭제·경고·오류)에 사이트 설정의
 * `codeBlock.lineEffects`를 더한다. 같은 이름이면 사이트 정의로 바꾼다.
 *
 * 정의는 저장 문법(주석 이름)·공개 화면 클래스·편집기 표시를 한 곳에서 정한다. 설정에 들어가므로 JSON으로 직렬화할 수
 * 있는 값만 가진다. 줄 접기(`collapse`)와 본문 연결 이름표(`anchor`)는 동작이 따로 있는 본체 효과라 여기에 없다.
 *
 * 이 파일은 설정을 읽지 않는다(설정 파일이 저작 API를 거쳐 이 타입을 import한다). 사이트가 쓰는 목록은 `active.ts`다.
 */

/** 편집기 표시. 공개 화면 클래스와 따로 둔다(공개 화면은 줄 앞 표시를 CSS로 그린다). */
export interface CodeLineEffectEditor {
	/** 줄 배경 클래스. */
	readonly background?: string;
	/** 줄 전체에 긋는 물결 밑줄 색 클래스(예: `decoration-red-500`). */
	readonly wavy?: string;
	/** 줄 번호 칸 표시 글자와 그 클래스(예: `+`). 한 줄에 여럿이면 정의 순서가 앞선 것을 보인다. */
	readonly marker?: { readonly text: string; readonly className?: string };
}

export interface CodeLineEffectDefinition {
	/** 주석 이름(`// @line 이름`). 소문자 케밥. */
	readonly name: string;
	/** 줄 효과 메뉴 이름. 짧게 쓴다. */
	readonly label: string;
	/** 메뉴 아이콘(lucide 이름). 관리자 화면에 등록된 이름이어야 한다. */
	readonly icon?: string;
	/** 공개 화면이 그 줄에 붙이는 클래스. */
	readonly class: string;
	readonly editor?: CodeLineEffectEditor;
}

/** 사이트 설정의 코드 블록 설정. */
export interface CodeBlockConfig {
	/** 줄 효과. 본체 기본에 더하고, 같은 이름이면 바꾼다. 메뉴는 기본 다음에 더한 순서다. */
	readonly lineEffects?: readonly CodeLineEffectDefinition[];
}

const t = createActiveTranslator(codeBlockMessages);

/** 본체 기본 줄 효과. 선언 순서가 줄 효과 메뉴의 순서다. */
export const DEFAULT_CODE_LINE_EFFECTS: readonly CodeLineEffectDefinition[] = [
	{
		name: "highlight",
		get label() {
			return t("lineEffect.highlight");
		},
		icon: "highlighter",
		class: "inline-block w-full anno-mark-base bg-gray-400/20",
		editor: { background: "bg-gray-400/20" },
	},
	{
		name: "plus",
		get label() {
			return t("lineEffect.plus");
		},
		icon: "plus",
		class:
			"inline-block w-full anno-mark-base anno-mark:content-['+'] anno-mark:text-gray-400 bg-green-400/10 shadow-[inset_2px_0_0_0_rgba(74,222,128,1)]",
		editor: {
			background: "bg-green-400/10 shadow-[inset_2px_0_0_0_rgba(74,222,128,1)]",
			marker: { text: "+", className: "text-green-600 cms-dark:text-green-400" },
		},
	},
	{
		name: "minus",
		get label() {
			return t("lineEffect.minus");
		},
		icon: "minus",
		class:
			"inline-block w-full anno-mark-base anno-mark:content-['-'] anno-mark:text-gray-400 bg-red-400/10 shadow-[inset_2px_0_0_0_rgba(239,68,68,1)]",
		editor: {
			background: "bg-red-400/10 shadow-[inset_2px_0_0_0_rgba(239,68,68,1)]",
			marker: { text: "−", className: "text-red-600 cms-dark:text-red-400" },
		},
	},
	{
		name: "warning",
		get label() {
			return t("lineEffect.warning");
		},
		icon: "triangle-alert",
		class: "underline decoration-wavy decoration-yellow-400/80",
		editor: { wavy: "decoration-yellow-400/80" },
	},
	{
		name: "error",
		get label() {
			return t("lineEffect.error");
		},
		icon: "circle-x",
		class: "underline decoration-wavy decoration-red-500",
		editor: { wavy: "decoration-red-500" },
	},
];

/** 줄 효과로 쓸 수 없는 이름. 본체 줄 효과(접기·이름표)와 글자 효과 이름이다. */
const RESERVED = new Set(["collapse", "anchor", "fold", "strong", "em", "del", "u", "tooltip"]);
const NAME = /^[a-z][a-z0-9-]*$/;

/** 사이트 설정이 맞는지 확인한다. 틀리면 앱이 뜰 때 알린다. */
export function validateCodeBlockConfig(config: CodeBlockConfig | undefined): void {
	const seen = new Set<string>();
	for (const effect of config?.lineEffects ?? []) {
		const at = `cms.config: codeBlock.lineEffects.${effect.name}`;
		if (!NAME.test(effect.name)) throw new Error(`${at}: name must be lower-case kebab`);
		if (RESERVED.has(effect.name.toLowerCase())) throw new Error(`${at}: name is reserved`);
		if (seen.has(effect.name)) throw new Error(`${at}: name is duplicated`);
		seen.add(effect.name);
		if (!effect.label.trim()) throw new Error(`${at}: label is empty`);
		if (typeof effect.class !== "string") throw new Error(`${at}: class must be a string`);
	}
}

/** 기본 줄 효과에 사이트 정의를 합친다. 같은 이름은 그 자리에서 바꾸고, 새 이름은 뒤에 붙인다. */
export function resolveCodeLineEffects(
	added: readonly CodeLineEffectDefinition[] | undefined,
): readonly CodeLineEffectDefinition[] {
	const byName = new Map(DEFAULT_CODE_LINE_EFFECTS.map((effect) => [effect.name, effect]));
	for (const effect of added ?? []) byName.set(effect.name, effect);
	return [...byName.values()];
}
