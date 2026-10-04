import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { CMS_ROUTE_PATTERNS, createCmsRouteHandler, matchRoute } from "../router";

vi.mock("../../adapters/auth", () => ({
	authGateway: { verifyAdmin: async () => ({ userId: "u", accountId: "g", isAdmin: true }) },
	AuthError: class AuthError extends Error {},
}));

const auth = vi.hoisted(() => ({
	basePath: "/api/cms/auth" as string | undefined,
	handlers: {
		GET: vi.fn(async (_request: Request) => new Response("auth-get")),
		POST: vi.fn(async (_request: Request) => new Response("auth-post")),
	},
}));

vi.mock("../../container", () => ({
	getCmsContentStore: () => ({ getPreferences: async () => null }),
	getCmsAuth: () => auth,
}));

describe("관리자 API 경로표", () => {
	it("이름 있는 조각이 [이름] 조각보다 먼저 맞고, 매개변수를 꺼낸다", () => {
		expect(matchRoute(["v1", "entries"])?.params).toEqual({});
		expect(matchRoute(["v1", "entries", "abc"])?.params).toEqual({ id: "abc" });
		expect(matchRoute(["v1", "entries", "abc", "publish"])?.params).toEqual({ id: "abc" });
		expect(matchRoute(["v1", "media", "uploads"])?.params).toEqual({});
		expect(matchRoute(["v1", "media", "m1", "complete"])?.params).toEqual({ id: "m1" });
		expect(matchRoute(["v1", "entries", ""])).toBeNull();
		expect(matchRoute(["v1", "nope"])).toBeNull();
		expect(matchRoute(["v2", "entries"])).toBeNull();
	});

	it("공개 API는 본체 선택 기능이고(서버 설정 publicApi), AI·예약 경로는 플러그인이 더한다", () => {
		expect(CMS_ROUTE_PATTERNS).toContain("v1/public/entries");
		expect(CMS_ROUTE_PATTERNS).toContain("v1/public/entries/[collection]/[slug]");
		expect(CMS_ROUTE_PATTERNS.some((pattern) => pattern.startsWith("v1/ai"))).toBe(false);
		expect(CMS_ROUTE_PATTERNS.some((pattern) => pattern.includes("schedule"))).toBe(false);
		expect(CMS_ROUTE_PATTERNS).toHaveLength(25);
	});

	it("없는 경로는 404, 없는 메서드는 405, 맞는 경로는 그 라우트가 받는다", async () => {
		const handler = createCmsRouteHandler();
		const call = (method: "GET" | "DELETE", path: string) =>
			handler[method](
				new NextRequest(`http://localhost/api/cms/${path}`, { method, headers: { origin: "http://localhost" } }),
				{ params: Promise.resolve({ path: path.split("/") }) },
			);
		expect((await call("GET", "v1/nope")).status).toBe(404);
		expect((await call("DELETE", "v1/preferences")).status).toBe(405);
		expect((await call("GET", "v1/preferences")).status).toBe(200);
	});

	it("로그인 경로가 기본(`/api/cms/auth`)이면 `auth/*`를 로그인 처리기로 넘긴다", async () => {
		const handler = createCmsRouteHandler();
		const call = (method: "GET" | "POST" | "DELETE", path: string) =>
			handler[method](new NextRequest(`http://localhost/api/cms/${path}`, { method }), {
				params: Promise.resolve({ path: path.split("/") }),
			});
		expect(await (await call("GET", "auth/session")).text()).toBe("auth-get");
		expect(await (await call("POST", "auth/signin/github")).text()).toBe("auth-post");
		expect(auth.handlers.GET).toHaveBeenCalledTimes(1);
		expect((await call("DELETE", "auth/session")).status).toBe(405);

		// 앱이 로그인 경로를 따로 두면(`basePath: "/api/auth"`) CMS API 아래로는 받지 않는다.
		auth.basePath = "/api/auth";
		expect((await call("GET", "auth/session")).status).toBe(404);
		expect(auth.handlers.GET).toHaveBeenCalledTimes(1);
		auth.basePath = "/api/cms/auth";
	});
});
