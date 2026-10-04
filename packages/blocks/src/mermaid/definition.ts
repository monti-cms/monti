import { createActiveTranslator, defineBlock } from "@monti-cms/core";
import { keywordList } from "../shared/text";
import { mermaidMessages } from "./messages";

const t = createActiveTranslator(mermaidMessages);

/** Mermaid 다이어그램(` ```mermaid `). 편집기 미리보기는 확장이(사이트가 바꿀 수 있다), 공개 화면은 사이트가 그린다. */
export const mermaidBlock = defineBlock({
	name: "mermaid",
	get label() {
		return t("label");
	},
	get description() {
		return t("description");
	},
	syntax: { kind: "fence", lang: "mermaid" },
	component: "Mermaid",
	attributes: {},
	editor: {
		view: "node",
		insertable: true,
		get keywords() {
			return ["mermaid", ...keywordList(t("keywords"))];
		},
		icon: "workflow",
		get placeholder() {
			return t("placeholder");
		},
		insert: { code: "graph TD\n  A --> B" },
	},
});
