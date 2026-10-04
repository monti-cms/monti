import { adminRoute, json, readJsonBody } from "../http/v1/handler";
import { handleTextCheck, type TextCheckRouteOptions } from "./server-handler";

export {
	handleTextCheck,
	parseTextCheckBody,
	type ServerTextCheck,
	type TextCheckResponse,
	type TextCheckRouteOptions,
} from "./server-handler";

/**
 * 맞춤법·문장 검사 서버 경로(`@monti-cms/core/plugin/server`). 관리자만 부를 수 있고(본체 관리자 인증·동일 출처 검사),
 * `{ segments }`를 받아 `{ issues }`를 돌려준다. 브라우저 쪽은 `remoteTextChecker({ url })`로 이 경로를 부른다.
 *
 * ```ts
 * // app/api/text-check/route.ts
 * export const POST = textCheckRoute({
 *   check: async (segments, { signal }) => callMyProvider(segments, process.env.MY_API_KEY, signal),
 * });
 * ```
 */
export function textCheckRoute(options: TextCheckRouteOptions) {
	return adminRoute(async ({ request }) => {
		const result = await handleTextCheck(await readJsonBody(request), options, request.signal);
		return json(result.body, { status: result.status });
	});
}
