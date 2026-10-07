import { describe, expect, it, vi } from "vitest";
import { fakeCms } from "../../cms";
import { CMS_ROUTE_PATTERNS, matchRoute, pathFromRequest } from "../router";

const handlers = {
	GET: vi.fn(async (_request: Request) => new Response("auth-get")),
	POST: vi.fn(async (_request: Request) => new Response("auth-post")),
};

const store = { getPreferences: async () => null };
const cms = fakeCms({ store, auth: { basePath: "/api/cms/auth", handlers } });

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
	});

	it("an unknown path is 404, an unknown method is 405, and a matching path goes to that route", async () => {
		const call = (method: "GET" | "DELETE", path: string) =>
			cms.handle(new Request(`http://localhost/api/cms/${path}`, { method, headers: { origin: "http://localhost" } }));
		expect((await call("GET", "v1/nope")).status).toBe(404);
		expect((await call("DELETE", "v1/preferences")).status).toBe(405);
		expect((await call("GET", "v1/preferences")).status).toBe(200);
	});

	it("when the auth path is the default (`/api/cms/auth`), forwards `auth/*` to the auth handler", async () => {
		const call = (instance: typeof cms, method: "GET" | "POST" | "DELETE", path: string) =>
			instance.handle(new Request(`http://localhost/api/cms/${path}`, { method }));
		expect(await (await call(cms, "GET", "auth/session")).text()).toBe("auth-get");
		expect(await (await call(cms, "POST", "auth/signin/github")).text()).toBe("auth-post");
		expect(handlers.GET).toHaveBeenCalledTimes(1);
		expect((await call(cms, "DELETE", "auth/session")).status).toBe(405);

		// If the app sets a separate auth path (`basePath: "/api/auth"`), it is not accepted under the CMS API.
		const elsewhere = fakeCms({ store, auth: { basePath: "/api/auth", handlers } });
		expect((await call(elsewhere, "GET", "auth/session")).status).toBe(404);
		expect(handlers.GET).toHaveBeenCalledTimes(1);
	});

	it("`handle` reads the path from the request URL, with no framework in between", async () => {
		const response = await cms.handle(new Request("http://localhost/api/cms/v1/preferences"));
		expect(response).toBeInstanceOf(Response);
		expect(response.status).toBe(200);
		expect((await cms.handle(new Request("http://localhost/elsewhere/v1/preferences"))).status).toBe(404);
		expect(
			(await cms.handle(new Request("http://localhost/api/cms/v1/preferences", { method: "OPTIONS" }))).status,
		).toBe(405);
	});

	it("`handle` takes the path segments from the options when the host already split them", async () => {
		const response = await cms.handle(new Request("http://localhost/mounted/anywhere"), {
			path: ["v1", "preferences"],
		});
		expect(response.status).toBe(200);
	});

	it("the path comes from the URL: decoded, query ignored, empty segments dropped", () => {
		expect(pathFromRequest(new Request("http://localhost/api/cms/v1/entries/a%20b?x=1"))).toEqual([
			"v1",
			"entries",
			"a b",
		]);
		expect(pathFromRequest(new Request("http://localhost/api/cms/v1//meta/"))).toEqual(["v1", "meta"]);
		expect(pathFromRequest(new Request("http://localhost/api/cms"))).toBeNull();
		expect(pathFromRequest(new Request("http://localhost/api/cms/v1/%E0%A4%A"))).toBeNull();
	});
});
