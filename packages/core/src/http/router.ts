import type { NextRequest } from "next/server";
import { authGateway } from "../adapters/auth";
import { getCmsAuth } from "../container";
import { assertPluginRoutesFree } from "../plugin/collisions";
import { pluginRoutes } from "../plugin/server";
import { CMS_AUTH_BASE_PATH } from "../server/define";
import * as r9 from "./v1/bulk/route";
import * as r12 from "./v1/entries/[id]/archive/route";
import * as r13 from "./v1/entries/[id]/duplicate/route";
import * as r14 from "./v1/entries/[id]/publish/route";
import * as r15 from "./v1/entries/[id]/relations/route";
import * as r16 from "./v1/entries/[id]/restore/route";
import * as r11 from "./v1/entries/[id]/route";
import * as r18 from "./v1/entries/[id]/translations/route";
import * as r19 from "./v1/entries/[id]/trash/route";
import * as r20 from "./v1/entries/[id]/unarchive/route";
import * as r10 from "./v1/entries/route";
import { HttpError, handleApiError } from "./v1/error-handler";
import * as r21 from "./v1/export/route";
import * as r23 from "./v1/folders/[id]/route";
import * as r22 from "./v1/folders/route";
import * as r28 from "./v1/media/[id]/complete/route";
import * as r27 from "./v1/media/[id]/route";
import * as r25 from "./v1/media/cleanup/route";
import * as r24 from "./v1/media/route";
import * as r26 from "./v1/media/uploads/route";
import * as r29 from "./v1/meta/route";
import * as r30 from "./v1/preferences/route";
import * as rPublicEntry from "./v1/public/entries/[collection]/[slug]/route";
import * as rPublicEntries from "./v1/public/entries/route";
import { validateSameOrigin } from "./v1/security";
import * as r34 from "./v1/templates/[id]/route";
import * as r33 from "./v1/templates/route";

/**
 * 관리자 API(`/api/cms/v1/*`) 경로표. 앱은 catch-all 라우트 하나(`app/api/cms/[...path]/route.ts`)에서
 * `createCmsRouteHandler()`를 내보낸다. 경로 모양은 Next 라우트 폴더와 같다(`[id]`는 한 칸).
 */

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
type RouteHandler = (request: NextRequest, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
/** 라우트 파일. 처리기의 매개변수 모양(`{ id }` 등)이 라우트마다 달라, 부를 때 `RouteHandler`로 본다. */
type RouteModule = Partial<Record<Method, unknown>>;

const ROUTES: ReadonlyArray<{ pattern: string; module: RouteModule }> = [
	{ pattern: "v1/bulk", module: r9 },
	{ pattern: "v1/entries", module: r10 },
	{ pattern: "v1/entries/[id]", module: r11 },
	{ pattern: "v1/entries/[id]/archive", module: r12 },
	{ pattern: "v1/entries/[id]/duplicate", module: r13 },
	{ pattern: "v1/entries/[id]/publish", module: r14 },
	{ pattern: "v1/entries/[id]/relations", module: r15 },
	{ pattern: "v1/entries/[id]/restore", module: r16 },
	{ pattern: "v1/entries/[id]/translations", module: r18 },
	{ pattern: "v1/entries/[id]/trash", module: r19 },
	{ pattern: "v1/entries/[id]/unarchive", module: r20 },
	{ pattern: "v1/export", module: r21 },
	{ pattern: "v1/folders", module: r22 },
	{ pattern: "v1/folders/[id]", module: r23 },
	{ pattern: "v1/media", module: r24 },
	{ pattern: "v1/media/cleanup", module: r25 },
	{ pattern: "v1/media/uploads", module: r26 },
	{ pattern: "v1/media/[id]", module: r27 },
	{ pattern: "v1/media/[id]/complete", module: r28 },
	{ pattern: "v1/meta", module: r29 },
	{ pattern: "v1/preferences", module: r30 },
	// 공개 JSON API(로그인 없이 공개본만). 서버 설정 `publicApi`가 없으면 404다.
	{ pattern: "v1/public/entries", module: rPublicEntries },
	{ pattern: "v1/public/entries/[collection]/[slug]", module: rPublicEntry },
	{ pattern: "v1/templates", module: r33 },
	{ pattern: "v1/templates/[id]", module: r34 },
];

type CompiledRoute = { segments: string[]; module: RouteModule; guarded: boolean };
const compile = (
	routes: ReadonlyArray<{ pattern: string; module: RouteModule; public?: boolean }>,
	guarded: boolean,
): CompiledRoute[] =>
	routes.map((route) => ({
		segments: route.pattern.split("/"),
		module: route.module,
		guarded: guarded && !route.public,
	}));
// 본체 경로는 각 라우트가 `adminRoute`로 스스로 감싼다.
const COMPILED = compile(ROUTES, false);
let pluginCompiled: Promise<CompiledRoute[]> | undefined;
const compiledPluginRoutes = () => {
	// 플러그인 경로는 본체가 관리자 확인으로 감싼다(`public: true`만 뺀다). 빠뜨린 인증이 열린 경로가 되지 않게 한다.
	// 본체·다른 플러그인과 주소가 겹치면 오류다(본체가 먼저 맞아 플러그인 경로가 조용히 가려지지 않게). 실패는 기억하지 않는다.
	pluginCompiled ??= pluginRoutes()
		.then((routes) => {
			assertPluginRoutesFree(
				ROUTES.map((route) => route.pattern),
				routes,
			);
			return compile(routes, true);
		})
		.catch((error) => {
			pluginCompiled = undefined;
			throw error;
		});
	return pluginCompiled;
};

/** 경로 조각과 맞는 라우트와 매개변수. 이름 있는 조각이 `[이름]` 조각보다 먼저 맞는다(표 순서). */
export function matchRoute(
	path: readonly string[],
	routes: readonly CompiledRoute[] = COMPILED,
): { module: RouteModule; params: Record<string, string>; guarded: boolean } | null {
	for (const { segments, module, guarded } of routes) {
		if (segments.length !== path.length) continue;
		const params: Record<string, string> = {};
		const matched = segments.every((segment, index) => {
			const part = path[index] ?? "";
			if (segment.startsWith("[") && segment.endsWith("]")) {
				params[segment.slice(1, -1)] = part;
				return part !== "";
			}
			return segment === part;
		});
		if (matched) return { module, params, guarded };
	}
	return null;
}

/** 등록된 관리자 API 경로(문서·테스트용). */
export const CMS_ROUTE_PATTERNS: readonly string[] = ROUTES.map((route) => route.pattern);

const notFound = () => handleApiError(new HttpError(404, "not_found", "Unknown CMS API path"));

/**
 * catch-all 라우트 처리기. `params.path`는 `/api/cms/` 뒤의 경로 조각이다(예: `["v1", "entries", "<id>"]`).
 * 없는 경로는 404, 경로는 있지만 그 메서드가 없으면 405다. `auth/*`는 로그인 연결의 경로가 기본(`/api/cms/auth`)일 때
 * 로그인 처리기로 넘긴다(로그인 라우트 파일이 따로 필요 없다).
 */
export type CmsRouteHandler = (
	request: NextRequest,
	context: { params: Promise<{ path: string[] }> },
) => Promise<Response>;

export function createCmsRouteHandler(): Record<Method, CmsRouteHandler> {
	const handle =
		(method: Method): CmsRouteHandler =>
		async (request, context) => {
			const { path = [] } = await context.params;
			if (path[0] === "auth") {
				const auth = getCmsAuth();
				if (auth.basePath !== CMS_AUTH_BASE_PATH) return notFound();
				if (method !== "GET" && method !== "POST") {
					return handleApiError(new HttpError(405, "method_not_allowed", `${method} is not allowed here`));
				}
				return auth.handlers[method](request);
			}
			// 본체 경로에 없으면 플러그인 경로표에서 찾는다.
			const matched = matchRoute(path) ?? matchRoute(path, await compiledPluginRoutes());
			if (!matched) return notFound();
			const handler = matched.module[method] as RouteHandler | undefined;
			if (!handler) {
				return handleApiError(new HttpError(405, "method_not_allowed", `${method} is not allowed here`));
			}
			if (matched.guarded) {
				try {
					validateSameOrigin(request);
					await authGateway.verifyAdmin();
				} catch (error) {
					return handleApiError(error);
				}
			}
			return handler(request, { params: Promise.resolve(matched.params) });
		};
	return {
		GET: handle("GET"),
		POST: handle("POST"),
		PATCH: handle("PATCH"),
		PUT: handle("PUT"),
		DELETE: handle("DELETE"),
	};
}
