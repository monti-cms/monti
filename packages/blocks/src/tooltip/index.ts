import { definePlugin } from "@monti-cms/core";
import { tooltipBlock } from "./definition";

export { tooltipBlock } from "./definition";

/**
 * 툴팁(`:tooltip[글자]{content="설명"}`). 사이트 설정의 `plugins`에 넣는다.
 *
 * ```ts
 * plugins: [tooltip()]
 * ```
 *
 * 편집기에는 서식 도구·글자 버블·슬래시 메뉴의 `툴팁`이 생긴다. 공개 화면은 이 확장이 기본 공개 컴포넌트를 준다(`render`, `@monti-cms/core/render`가 쓴다). 사이트는 같은 이름의 컴포넌트로 덮어쓸 수 있다.
 * 코드 블록 안 글자 툴팁(코드 펜스 주석)은 본체 코드 블록 기능이라 이 확장과 따로다.
 */
export const tooltip = () =>
	definePlugin({
		name: "tooltip",
		options: {},
		blocks: [tooltipBlock],
		admin: () => import("@monti-cms/blocks/tooltip/admin"),
		render: () => import("@monti-cms/blocks/tooltip/render"),
	});
