import { definePlugin } from "@monti-cms/core";
import { tabBlock, tabsBlock } from "./definition";

export { tabBlock, tabsBlock } from "./definition";

/**
 * 탭 블록(`::::tabs` 안에 `:::tab` 2~8개). 사이트 설정의 `plugins`에 넣는다.
 *
 * ```ts
 * plugins: [tabs()]
 * ```
 *
 * 공개 화면은 이 확장이 기본 공개 컴포넌트를 준다(`render`, `@monti-cms/core/render`가 쓴다). 사이트는 같은 이름의 컴포넌트로 덮어쓸 수 있다.
 */
export const tabs = () =>
	definePlugin({
		name: "tabs",
		options: {},
		blocks: [tabsBlock, tabBlock],
		admin: () => import("@monti-cms/blocks/tabs/admin"),
		render: () => import("@monti-cms/blocks/tabs/render"),
	});
