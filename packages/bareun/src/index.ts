import { definePlugin } from "@monti-cms/core";
import { BAREUN_PLUGIN_NAME, type BareunOptions, resolveBareunOptions } from "./options";

export { type BareunIssueSegment, type BareunResponse, type BareunRevisedBlock, bareunIssues } from "./mapping";
export { BAREUN_PLUGIN_NAME, type BareunOptions, type ResolvedBareunOptions } from "./options";

/**
 * 바른(Bareun) 맞춤법·문장 검사기. 사이트 설정의 `plugins`에 넣으면 편집기에 "맞춤법 검사" 버튼이 생기고,
 * 서버 경로(`/api/cms/v1/text-check/bareun`)가 API 키로 바른을 부른다. 키는 서버 환경 변수(기본 `BAREUN_API_KEY`)에 둔다.
 *
 * ```ts
 * plugins: [bareun()]
 * ```
 */
export const bareun = (options?: BareunOptions) =>
	definePlugin({
		name: BAREUN_PLUGIN_NAME,
		options: resolveBareunOptions(options),
		// 브라우저 묶음에서는 `./server`가 빈 진입점(`server.browser.ts`)으로 바뀐다(package.json `exports`).
		server: () => import("@monti-cms/bareun/server"),
		admin: () => import("@monti-cms/bareun/admin"),
	});
