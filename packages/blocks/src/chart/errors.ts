import { type MessageVars, translate } from "@monti-cms/core";
import { chartMessages } from "./messages";
import type { ChartDslParseError } from "./types";

export type ChartMessageKey = keyof (typeof chartMessages)["messages"]["en"];

/** 차트 문구 사전에서 문구를 고르는 함수(관리자 언어 `createTranslator`, 글 언어 `translate` 중 쓰는 쪽이 만든다). */
export type ChartText = (key: ChartMessageKey, vars?: MessageVars) => string;

/** 차트 문법 오류 하나의 사람이 읽는 글(`3줄: …`). 파서는 코드와 값만 주고, 글은 쓰는 쪽의 언어로 만든다. */
export const chartErrorLine = (error: ChartDslParseError, text: ChartText): string =>
	text("error.line", { line: error.line, message: text(`error.${error.code}`, error.values) });

/**
 * 오류의 설명만(줄 번호 없이) 글 언어(`ko`·`ko-KR`·`en` …)로 만든다. 사이트가 줄 번호 문구를 따로 가질 때 쓴다. 모르는 언어는 영어다.
 */
export const chartErrorMessage = (error: ChartDslParseError, locale?: string): string =>
	translate(chartMessages, (locale ?? "").toLowerCase().split(/[-_]/)[0] ?? "", `error.${error.code}`, error.values);
