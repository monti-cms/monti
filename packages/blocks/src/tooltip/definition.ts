import { createActiveTranslator, defineBlock } from "@monti-cms/core";
import { tooltipMessages } from "./messages";

const t = createActiveTranslator(tooltipMessages);

/**
 * 툴팁(`:tooltip[글자]{content="설명"}`). 글자에 마우스를 올리면 설명을 보인다. 공개 화면은 사이트가 `Tooltip`
 * 컴포넌트로 그린다(`content` 속성, 글자는 자식).
 */
export const tooltipBlock = defineBlock({
	name: "tooltip",
	get label() {
		return t("label");
	},
	syntax: { kind: "text", directive: "tooltip" },
	component: "Tooltip",
	attributes: {
		content: {
			type: "string",
			get label() {
				return t("content.label");
			},
			required: true,
			translatable: true,
		},
	},
	editor: { view: "mark" },
});
