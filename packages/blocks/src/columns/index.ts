import { definePlugin } from "@monti-cms/core";
import { columnBlock, columnsBlock } from "./definition";

export { columnBlock, columnsBlock } from "./definition";

/**
 * 단 나누기 블록(`::::columns` 안에 `:::column` 2~4개). 사이트 설정의 `plugins`에 넣는다.
 *
 * ```ts
 * plugins: [columns()]
 * ```
 *
 * 공개 화면은 이 확장이 기본 공개 컴포넌트를 준다(`render`, `@monti-cms/core/render`가 쓴다). 사이트는 같은 이름의 컴포넌트로 덮어쓸 수 있다.
 */
export const columns = () =>
	definePlugin({
		name: "columns",
		options: {},
		blocks: [columnsBlock, columnBlock],
		admin: () => import("@monti-cms/blocks/columns/admin"),
		render: () => import("@monti-cms/blocks/columns/render"),
	});

export * from "./layout";
