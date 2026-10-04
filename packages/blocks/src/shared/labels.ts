import { translate } from "@monti-cms/core";
import { type ChartText, chartErrorLine } from "../chart/errors";
import { chartMessages } from "../chart/messages";
import type { ChartRenderError } from "../chart/types";
import { publicLabelMessages } from "./labels.messages";

/** 공개 화면 블록이 독자에게 보이는 고정 문구. 사이트 언어(`context.locale`)에 맞춰 고른다. */
export interface BlockLabels {
	readonly calloutNote: string;
	readonly calloutTip: string;
	readonly calloutInfo: string;
	readonly calloutWarning: string;
	readonly calloutDanger: string;
	/** 제목이 없는 접기 블록의 제목. */
	readonly collapsibleFallback: string;
	readonly chartError: string;
	/** 차트 문법 오류 한 줄(`3줄: …`). 오류의 글은 코드와 값에서 이 언어로 만든다. */
	readonly chartErrorLine: (error: ChartRenderError) => string;
}

/** 언어 코드(`ko`·`ko-KR`·`en` …)의 앞 부분. 모르는 언어는 사전이 영어로 고른다. */
const languageOf = (locale?: string): string => (locale ?? "").toLowerCase().split(/[-_]/)[0] ?? "";

/** 언어 코드(`ko`·`ko-KR`·`en` …)의 문구. 모르는 언어는 영어다. */
export function blockLabels(locale?: string): BlockLabels {
	const language = languageOf(locale);
	const text = (key: keyof (typeof publicLabelMessages)["messages"]["en"]) =>
		translate(publicLabelMessages, language, key);
	const chart: ChartText = (key, vars) => translate(chartMessages, language, key, vars);
	return {
		calloutNote: text("calloutNote"),
		calloutTip: text("calloutTip"),
		calloutInfo: text("calloutInfo"),
		calloutWarning: text("calloutWarning"),
		calloutDanger: text("calloutDanger"),
		collapsibleFallback: text("collapsibleFallback"),
		chartError: chart("error.title"),
		chartErrorLine: (error) => chartErrorLine(error, chart),
	};
}
