import { definePlugin } from "@monti-cms/core";
import { calloutBlock } from "./definition";

export { calloutBlock } from "./definition";

/**
 * 콜아웃 블록(`:::callout`). 참고·경고처럼 눈에 띄게 강조하는 상자다. 사이트 설정의 `plugins`에 넣는다.
 *
 * ```ts
 * plugins: [callout()]
 * ```
 *
 * 공개 화면은 이 확장이 기본 공개 컴포넌트를 준다(`render`, `@monti-cms/core/render`가 쓴다). 사이트는 같은 이름의 컴포넌트로 덮어쓸 수 있다.
 */
export const callout = () =>
	definePlugin({
		name: "callout",
		options: {},
		blocks: [calloutBlock],
		admin: () => import("@monti-cms/blocks/callout/admin"),
		render: () => import("@monti-cms/blocks/callout/render"),
	});
