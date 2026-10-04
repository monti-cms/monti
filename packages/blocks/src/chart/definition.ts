import { createActiveTranslator, defineBlock } from "@monti-cms/core";
import { keywordList } from "../shared/text";
import { chartMessages } from "./messages";

const t = createActiveTranslator(chartMessages);

/** 차트(` ```chart `). 차트 문법은 `parseChartDsl`이 읽는다. 편집기 미리보기는 확장이(사이트가 바꿀 수 있다), 공개 화면은 사이트가 그린다. */
export const chartBlock = defineBlock({
	name: "chart",
	get label() {
		return t("label");
	},
	get description() {
		return t("description");
	},
	syntax: { kind: "fence", lang: "chart" },
	component: "Chart",
	attributes: {},
	editor: {
		view: "node",
		insertable: true,
		get keywords() {
			return ["chart", ...keywordList(t("keywords"))];
		},
		icon: "chart-column",
		get placeholder() {
			return t("placeholder");
		},
		get insert() {
			return {
				code: [
					"chart bar",
					"x month",
					`series views | ${t("insert.series")} | chart-1`,
					"",
					"data",
					"month | views",
					"Jan | 1200",
				].join("\n"),
			};
		},
	},
});
