import { describe, expect, it } from "vitest";
import { createTranslator } from "../../../i18n";
import { annotationConfig, CODE_LINE_EFFECTS, isLineEffectName } from "../active";
import { fromCodeFenceToCodeBlockDocument } from "../code-fence-to-document";
import { createAnnotationConfig } from "../constants";
import { fromCodeBlockDocumentToCodeFence } from "../document-to-code-fence";
import { DEFAULT_CODE_LINE_EFFECTS, resolveCodeLineEffects, validateCodeBlockConfig } from "../line-effects";
import { codeBlockMessages } from "../messages";
import type { AnnotationConfigItem } from "../types";

/** 정의 목록으로 바꾸기 전의 주석 설정(공개 화면 클래스가 그대로인지 본다). */
const BEFORE: AnnotationConfigItem[] = [
	{ name: "Tooltip", kind: "render", source: "mdx-text", render: "Tooltip", scopes: ["char", "document"] },
	{ name: "strong", kind: "render", source: "mdx-text", render: "strong", scopes: ["char", "document"] },
	{ name: "em", kind: "render", source: "mdx-text", render: "em", scopes: ["char", "document"] },
	{ name: "del", kind: "render", source: "mdx-text", render: "del", scopes: ["char", "document"] },
	{ name: "u", kind: "render", source: "mdx-text", render: "u", scopes: ["char", "document"] },
	{ name: "fold", kind: "render", source: "mdx-text", render: "fold", scopes: ["char", "document"] },
	{
		name: "plus",
		kind: "class",
		class:
			"inline-block w-full anno-mark-base anno-mark:content-['+'] anno-mark:text-gray-400 bg-green-400/10 shadow-[inset_2px_0_0_0_rgba(74,222,128,1)]",
		scopes: ["line"],
	},
	{
		name: "minus",
		kind: "class",
		class:
			"inline-block w-full anno-mark-base anno-mark:content-['-'] anno-mark:text-gray-400 bg-red-400/10 shadow-[inset_2px_0_0_0_rgba(239,68,68,1)]",
		scopes: ["line"],
	},
	{ name: "highlight", kind: "class", class: "inline-block w-full anno-mark-base bg-gray-400/20", scopes: ["line"] },
	{ name: "warning", kind: "class", class: "underline decoration-wavy decoration-yellow-400/80", scopes: ["line"] },
	{ name: "error", kind: "class", class: "underline decoration-wavy decoration-red-500", scopes: ["line"] },
	{ name: "collapse", kind: "render", render: "collapse", scopes: ["line"] },
	{ name: "anchor", kind: "class", class: "code-anchor", scopes: ["line"] },
];

const byName = (items: readonly AnnotationConfigItem[] | undefined) =>
	Object.fromEntries((items ?? []).map((item) => [item.name, item]));

describe("코드 줄 효과 정의", () => {
	it("기본 정의는 예전 주석 설정과 같은 이름·클래스를 만든다", () => {
		expect(byName(createAnnotationConfig().annotations)).toEqual(byName(BEFORE));
		// 줄 효과가 없는 설정(예시 사이트)은 기본 그대로다.
		expect(CODE_LINE_EFFECTS).toEqual(DEFAULT_CODE_LINE_EFFECTS);
		expect(byName(annotationConfig.annotations)).toEqual(byName(BEFORE));
		// 메뉴 이름은 괄호 없이 짧게 쓴다.
		const t = createTranslator(codeBlockMessages);
		expect(DEFAULT_CODE_LINE_EFFECTS.map((effect) => effect.label)).toEqual([
			t("lineEffect.highlight"),
			t("lineEffect.plus"),
			t("lineEffect.minus"),
			t("lineEffect.warning"),
			t("lineEffect.error"),
		]);
	});

	it("사이트 정의는 같은 이름을 그 자리에서 바꾸고 새 이름을 뒤에 붙인다", () => {
		const effects = resolveCodeLineEffects([
			{ name: "highlight", label: "강조", class: "my-highlight" },
			{ name: "focus", label: "초점", icon: "eye", class: "my-focus", editor: { background: "bg-primary/10" } },
		]);
		expect(effects.map((effect) => effect.name)).toEqual(["highlight", "plus", "minus", "warning", "error", "focus"]);
		expect(effects[0]?.class).toBe("my-highlight");

		const config = createAnnotationConfig(effects);
		const value = ["// @line focus {0-0}", "const a = 1;"].join("\n");
		const document = fromCodeFenceToCodeBlockDocument({ type: "code", lang: "ts", value }, config);
		expect(document.annotations).toEqual([expect.objectContaining({ name: "focus", class: "my-focus" })]);
		expect(fromCodeBlockDocumentToCodeFence(document, config).value).toBe(value);
	});

	it("편집기는 정의된 줄 효과와 접기·이름표만 알아본다", () => {
		expect(isLineEffectName("plus")).toBe(true);
		expect(isLineEffectName("collapse")).toBe(true);
		expect(isLineEffectName("anchor")).toBe(true);
		expect(isLineEffectName("focus")).toBe(false);
	});

	it("틀린 설정은 바로 알린다", () => {
		expect(() => validateCodeBlockConfig({ lineEffects: [{ name: "Focus", label: "초점", class: "" }] })).toThrow(
			/lower-case kebab/,
		);
		expect(() => validateCodeBlockConfig({ lineEffects: [{ name: "collapse", label: "접기", class: "" }] })).toThrow(
			/reserved/,
		);
		expect(() =>
			validateCodeBlockConfig({
				lineEffects: [
					{ name: "focus", label: "초점", class: "a" },
					{ name: "focus", label: "초점", class: "b" },
				],
			}),
		).toThrow(/duplicated/);
		expect(() => validateCodeBlockConfig({ lineEffects: [{ name: "focus", label: " ", class: "a" }] })).toThrow(
			/label/,
		);
		expect(() => validateCodeBlockConfig(undefined)).not.toThrow();
	});
});
