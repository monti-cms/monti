import { definePlugin } from "@monti-cms/core";
import { chartAiContribution } from "./ai";
import { chartBlock } from "./definition";

export { chartBlock } from "./definition";
export { chartMessages } from "./messages";

/**
 * 차트 블록(` ```chart `). 사이트 설정의 `plugins`에 넣는다.
 *
 * ```ts
 * plugins: [chart()]
 * ```
 *
 * 편집기는 코드 입력 칸과 미리보기로 편집한다. 미리보기는 이 확장이 recharts로 그린다(선택 의존성 `recharts`를 설치한다).
 * 사이트가 `fencePreviews.chart`로 바꿀 수 있다. 공개 화면은 이 확장의 기본 `Chart` 컴포넌트가 그리고 사이트가 덮어쓸 수 있다(코드는 `source` 속성,
 * `remarkFenceBlocksToMdx`). 차트 색은 CSS 변수 `--chart-1`~`--chart-5`(없으면 이 패키지 `styles.css`의 기본값)다.
 */
export const chart = () =>
	definePlugin({
		name: "chart",
		options: {},
		blocks: [chartBlock],
		admin: () => import("@monti-cms/blocks/chart/admin"),
		render: () => import("@monti-cms/blocks/chart/render"),
		// AI 플러그인이 있으면 만들기·고치기 기능이 저절로 붙는다(`./ai`).
		contributes: { ai: chartAiContribution },
	});

export * from "./dsl";
export { type ChartMessageKey, type ChartText, chartErrorLine, chartErrorMessage } from "./errors";
export * from "./layout";
export * from "./types";
