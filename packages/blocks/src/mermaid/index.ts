import { definePlugin } from "@monti-cms/core";
import { mermaidAiContribution } from "./ai";
import { mermaidBlock } from "./definition";

export { mermaidBlock } from "./definition";

/**
 * Mermaid 다이어그램 블록(` ```mermaid `). 사이트 설정의 `plugins`에 넣는다.
 *
 * ```ts
 * plugins: [mermaid()]
 * ```
 *
 * 편집기는 코드 입력 칸과 미리보기로 편집한다. 미리보기는 이 확장이 그린다(선택 의존성 `mermaid`를 설치한다). 사이트가
 * `fencePreviews.mermaid`로 바꿀 수 있다. 공개 화면은 이 확장의 기본 `Mermaid` 컴포넌트가 그리고 사이트가 덮어쓸 수 있다(코드는 `source` 속성,
 * `remarkFenceBlocksToMdx`).
 */
export const mermaid = () =>
	definePlugin({
		name: "mermaid",
		options: {},
		blocks: [mermaidBlock],
		admin: () => import("@monti-cms/blocks/mermaid/admin"),
		render: () => import("@monti-cms/blocks/mermaid/render"),
		// AI 플러그인이 있으면 만들기·고치기 기능이 저절로 붙는다(`./ai`).
		contributes: { ai: mermaidAiContribution },
	});
