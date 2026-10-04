import { createActiveTranslator, defineBlock } from "@monti-cms/core";
import { colorMessages } from "./messages";

const t = createActiveTranslator(colorMessages);

/**
 * 글자색·글자 배경색(`:color[글]{fg="#dc2626" fgDark="#f87171"}`). 헥스 값을 밝은·어두운 테마 짝으로 저장한다.
 * 고르기 목록과 값 검사는 `./colors`. 공개 화면은 사이트가 `Color` 컴포넌트로 그린다(`textColorProps`).
 */
export const colorBlock = defineBlock({
	name: "color",
	get label() {
		return t("label");
	},
	syntax: { kind: "text", directive: "color" },
	component: "Color",
	attributes: {
		fg: {
			type: "string",
			get label() {
				return t("fg.label");
			},
		},
		fgDark: {
			type: "string",
			get label() {
				return t("fgDark.label");
			},
		},
		bg: {
			type: "string",
			get label() {
				return t("bg.label");
			},
		},
		bgDark: {
			type: "string",
			get label() {
				return t("bgDark.label");
			},
		},
	},
	editor: { view: "mark" },
});
