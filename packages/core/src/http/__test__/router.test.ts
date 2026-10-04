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

describe("admin API route table", () => {
	it("named segments match before [name] segments, and params are extracted", () => {
		expect(matchRoute(["v1", "entries"])?.params).toEqual({});
		expect(matchRoute(["v1", "entries", "abc"])?.params).toEqual({ id: "abc" });
		expect(matchRoute(["v1", "entries", "abc", "publish"])?.params).toEqual({ id: "abc" });
		expect(matchRoute(["v1", "media", "uploads"])?.params).toEqual({});
		expect(matchRoute(["v1", "media", "m1", "complete"])?.params).toEqual({ id: "m1" });
		expect(matchRoute(["v1", "entries", ""])).toBeNull();
		expect(matchRoute(["v1", "nope"])).toBeNull();
		expect(matchRoute(["v2", "entries"])).toBeNull();
	});

	it("the public API is an optional core feature (server config publicApi), and AI and schedule routes are added by plugins", () => {
		expect(CMS_ROUTE_PATTERNS).toContain("v1/public/entries");
		expect(CMS_ROUTE_PATTERNS).toContain("v1/public/entries/[collection]/[slug]");
		expect(CMS_ROUTE_PATTERNS.some((pattern) => pattern.startsWith("v1/ai"))).toBe(false);
		expect(CMS_ROUTE_PATTERNS.some((pattern) => pattern.includes("schedule"))).toBe(false);
		expect(CMS_ROUTE_PATTERNS).toHaveLength(25);
	});

	it("an unknown path is 404, an unknown method is 405, and a matching path goes to that route", async () => {
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

	it("when the auth path is the default (`/api/cms/auth`), forwards `auth/*` to the auth handler", async () => {
		const handler = createCmsRouteHandler();
		const call = (method: "GET" | "POST" | "DELETE", path: string) =>
			handler[method](new NextRequest(`http://localhost/api/cms/${path}`, { method }), {
				params: Promise.resolve({ path: path.split("/") }),
			});
		expect(await (await call("GET", "auth/session")).text()).toBe("auth-get");
		expect(await (await call("POST", "auth/signin/github")).text()).toBe("auth-post");
		expect(auth.handlers.GET).toHaveBeenCalledTimes(1);
		expect((await call("DELETE", "auth/session")).status).toBe(405);

		// If the app sets a separate auth path (`basePath: "/api/auth"`), it is not accepted under the CMS API.
		auth.basePath = "/api/auth";
		expect((await call("GET", "auth/session")).status).toBe(404);
		expect(auth.handlers.GET).toHaveBeenCalledTimes(1);
		auth.basePath = "/api/cms/auth";
	});
});
