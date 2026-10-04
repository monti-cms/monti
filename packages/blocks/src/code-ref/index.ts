import { definePlugin } from "@monti-cms/core";
import { codeRefBlock } from "./definition";

export { codeRefBlock } from "./definition";

/**
 * 코드 연결(`:code-ref[글자]{to="c1"}`). 사이트 설정의 `plugins`에 넣는다.
 *
 * ```ts
 * plugins: [codeRef()]
 * ```
 *
 * 편집기에서는 글자를 고르고 `코드 연결`을 누른 뒤 코드 블록 줄을 고르거나, 코드 블록 줄 메뉴의 `본문 연결`로 시작한다.
 * 줄 이름표(`anchor` 줄 효과)와 잇기 화면은 본체 코드 블록 기능이고, 이 확장은 본문 쪽 꾸밈과 버블을 준다.
 * 공개 화면은 이 확장이 기본 공개 컴포넌트를 준다(`render`, `@monti-cms/core/render`가 쓴다). 사이트는 같은 이름의 컴포넌트로 덮어쓸 수 있다.
 */
export const codeRef = () =>
	definePlugin({
		name: "code-ref",
		options: {},
		blocks: [codeRefBlock],
		admin: () => import("@monti-cms/blocks/code-ref/admin"),
		render: () => import("@monti-cms/blocks/code-ref/render"),
	});
