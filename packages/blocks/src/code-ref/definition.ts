import { createActiveTranslator, defineBlock } from "@monti-cms/core";
import { codeRefMessages } from "./messages";

const t = createActiveTranslator(codeRefMessages);

/**
 * 코드 연결(`:code-ref[글자]{to="c1"}`). 본문 글자와 같은 글 코드 블록의 줄을 잇는다. `to`는 코드 블록 줄 이름표
 * (코드 펜스 주석 `// @line anchor {2-4} id="c1"`, 본체 코드 블록 기능)다. 공개 화면에서 글자에 마우스를 올리거나 누르면
 * 그 줄을 강조한다(사이트의 `CodeRef` 컴포넌트).
 *
 * `to`에 `codeAnchor`를 달아 관리자 편집기의 코드 블록이 줄 고르기·잇기 안내·마우스를 올린 줄 강조를 이 꾸밈으로 한다.
 */
export const codeRefBlock = defineBlock({
	name: "code-ref",
	get label() {
		return t("label");
	},
	syntax: { kind: "text", directive: "code-ref" },
	component: "CodeRef",
	attributes: {
		to: {
			type: "string",
			get label() {
				return t("to.label");
			},
			required: true,
			codeAnchor: true,
		},
	},
	editor: { view: "mark" },
});
