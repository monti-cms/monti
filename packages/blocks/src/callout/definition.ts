import { createActiveTranslator, defineBlock } from "@monti-cms/core";
import { keywordList } from "../shared/text";
import { calloutMessages } from "./messages";

// 이름표는 글자를 읽는 때에 고른다(설정 파일이 이 모듈을 불러오는 때에는 화면 언어를 아직 모른다).
const t = createActiveTranslator(calloutMessages);

/** 콜아웃(`:::callout{variant="tip" title="…"}`). 참고·경고처럼 눈에 띄게 강조하는 상자다. */
export const calloutBlock = defineBlock({
	name: "callout",
	get label() {
		return t("label");
	},
	get description() {
		return t("description");
	},
	syntax: { kind: "container", directive: "callout" },
	component: "Callout",
	attributes: {
		variant: {
			type: "string",
			get label() {
				return t("variant.label");
			},
			options: {
				get note() {
					return t("option.note");
				},
				get tip() {
					return t("option.tip");
				},
				get info() {
					return t("option.info");
				},
				get warning() {
					return t("option.warning");
				},
				get danger() {
					return t("option.danger");
				},
			},
			defaultValue: "note",
		},
		title: {
			type: "string",
			get label() {
				return t("title.label");
			},
			translatable: true,
		},
	},
	// 제목만 있는 콜아웃도 된다.
	children: { min: 0 },
	translateInside: true,
	editor: {
		view: "node",
		insertable: true,
		get keywords() {
			return ["callout", ...keywordList(t("keywords"))];
		},
		icon: "message-square-warning",
		get insert() {
			return { values: { variant: "info" }, text: t("insert.text") };
		},
	},
});
