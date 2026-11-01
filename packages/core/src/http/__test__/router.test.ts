import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "../../adapters/auth";
import { fakeCms } from "../../cms";
import type { PluginRoute } from "../../plugin/define";
import { CMS_ROUTE_PATTERNS, matchRoute, pathFromRequest } from "../router";
import type { AdminRequest } from "../v1/handler";

const handlers = {
	GET: vi.fn(async (_request: Request) => new Response("auth-get")),
	POST: vi.fn(async (_request: Request) => new Response("auth-post")),
};

const store = { getPreferences: async () => null };
const cms = fakeCms({ store, auth: { basePath: "/api/monti/auth", handlers } });

describe("admin API route table", () => {
	it("API-R1 named segments match before [name] segments, and params are extracted", () => {
		expect(matchRoute(["v1", "entries"])?.params).toEqual({});
		expect(matchRoute(["v1", "entries", "abc"])?.params).toEqual({ id: "abc" });
		// `search` is its own route, not an entry id.
		expect(matchRoute(["v1", "entries", "search"])?.params).toEqual({});
		expect(matchRoute(["v1", "entries", "abc", "publish"])?.params).toEqual({ id: "abc" });
		expect(matchRoute(["v1", "media", "uploads"])?.params).toEqual({});
		expect(matchRoute(["v1", "media", "m1", "complete"])?.params).toEqual({ id: "m1" });
		expect(matchRoute(["v1", "entries", ""])).toBeNull();
		expect(matchRoute(["v1", "nope"])).toBeNull();
		expect(matchRoute(["v2", "entries"])).toBeNull();
	});

	it("API-G1 every route of the table is admin-only, except the ones listed here", () => {
		// The only routes that may be called without the admin login, and the guard each one gets instead.
		const notAdmin = {
			"v1/session/first-admin": "same-origin-form",
			"v1/session/sign-in/[provider]": "same-origin-form",
			"v1/session/sign-out": "same-origin-form",
			"v1/public/entries": "public-read",
			"v1/public/entries/[collection]/[slug]": "public-read",
			"v1/events/retry": "admin-or-bearer",
			"v1/trash/purge": "admin-or-bearer",
			"v1/import/entries": "admin-upload",
			"v1/import/restore": "admin-upload",
		};
		// The access the router applies to a request on each path, with a placeholder for every `[name]` segment.
		const accessByPattern = CMS_ROUTE_PATTERNS.map((pattern) => {
			const path = pattern.split("/").map((segment) => (segment.startsWith("[") ? "x" : segment));
			return [pattern, matchRoute(path)?.access] as const;
		});

		expect(Object.fromEntries(accessByPattern.filter(([, access]) => access !== "admin"))).toEqual(notAdmin);
	});

	it("API-R1 an unknown path is 404, an unknown method is 405, and a matching path goes to that route", async () => {
		const call = (method: "GET" | "DELETE", path: string) =>
			cms.handle(
				new Request(`http://localhost/api/monti/${path}`, { method, headers: { origin: "http://localhost" } }),
			);
		expect((await call("GET", "v1/nope")).status).toBe(404);
		expect((await call("DELETE", "v1/preferences")).status).toBe(405);
		expect((await call("GET", "v1/preferences")).status).toBe(200);
	});

	it("AUTH-C3 when the auth path is the default (`/api/monti/auth`), forwards `auth/*` to the auth handler", async () => {
		const call = (instance: typeof cms, method: "GET" | "POST" | "DELETE", path: string) =>
			instance.handle(new Request(`http://localhost/api/monti/${path}`, { method }));
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
		const response = await cms.handle(new Request("http://localhost/api/monti/v1/preferences"));
		expect(response).toBeInstanceOf(Response);
		expect(response.status).toBe(200);
		expect((await cms.handle(new Request("http://localhost/elsewhere/v1/preferences"))).status).toBe(404);
		expect(
			(await cms.handle(new Request("http://localhost/api/monti/v1/preferences", { method: "OPTIONS" }))).status,
		).toBe(405);
	});

	it("API-R1 `handle` takes the path segments from the options when the host already split them", async () => {
		const response = await cms.handle(new Request("http://localhost/mounted/anywhere"), {
			path: ["v1", "preferences"],
		});
		expect(response.status).toBe(200);
	});

	it("API-R1 the path comes from the URL: decoded, query ignored, empty segments dropped", () => {
		expect(pathFromRequest(new Request("http://localhost/api/monti/v1/entries/a%20b?x=1"))).toEqual([
			"v1",
			"entries",
			"a b",
		]);
		expect(pathFromRequest(new Request("http://localhost/api/monti/v1//meta/"))).toEqual(["v1", "meta"]);
		expect(pathFromRequest(new Request("http://localhost/api/monti"))).toBeNull();
		expect(pathFromRequest(new Request("http://localhost/api/monti/v1/%E0%A4%A"))).toBeNull();
	});
});

describe("plugin routes", () => {
	const mocks = vi.hoisted(() => ({
		verifyAdmin: vi.fn(),
		privateGet: vi.fn(async (_input: AdminRequest) => new Response("private")),
		publicPost: vi.fn(async () => new Response("public")),
	}));

	const ORIGIN = "http://localhost";

	/** An instance whose plugins add these routes (the `example` plugin always has a private and a public one). */
	const instance = (...extra: { plugin: string; routes: readonly PluginRoute[] }[]) =>
		fakeCms({
			verifyAdmin: () => mocks.verifyAdmin(),
			plugins: [
				{
					name: "example",
					routes: [
						{ pattern: "v1/example/private", module: { GET: mocks.privateGet, POST: mocks.privateGet } },
						{ pattern: "v1/example/hook", module: { POST: mocks.publicPost }, access: "signed" },
						{
							pattern: "v1/example/feed",
							module: { GET: mocks.publicPost, POST: mocks.publicPost },
							access: "public-read",
						},
						{ pattern: "v1/example/form", module: { POST: mocks.publicPost }, access: "same-origin-form" },
					],
				},
				...extra.map(({ plugin, routes }) => ({ name: plugin, routes })),
			],
		});

	const call = (
		cms: ReturnType<typeof instance>,
		method: "GET" | "POST",
		path: string,
		headers: Record<string, string> = {},
	) =>
		cms.handle(
			new Request(`${ORIGIN}/api/monti/${path}`, {
				method,
				headers: { "content-type": "application/json", ...headers },
				...(method === "POST" ? { body: "{}" } : {}),
			}),
		);

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.verifyAdmin.mockResolvedValue({ userId: "u", accountId: "g", isAdmin: true });
	});

	describe("plugin API route default authentication", () => {
		it("API-G1 when not logged in, does not call the plugin route and returns 401", async () => {
			mocks.verifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Authentication required"));
			expect((await call(instance(), "GET", "v1/example/private")).status).toBe(401);
			expect(mocks.privateGet).not.toHaveBeenCalled();
		});

		it("API-G2 rejects a cross-origin change request before the login check", async () => {
			const response = await call(instance(), "POST", "v1/example/private", { origin: "https://evil.example.com" });
			expect(response.status).toBe(403);
			expect(mocks.verifyAdmin).not.toHaveBeenCalled();
			expect(mocks.privateGet).not.toHaveBeenCalled();
		});

		it("PLUG-S1 an admin reaches the plugin route", async () => {
			expect(await (await call(instance(), "POST", "v1/example/private", { origin: ORIGIN })).text()).toBe("private");
			expect(mocks.verifyAdmin).toHaveBeenCalledTimes(1);
		});

		it("PLUG-S1 a plugin route gets the instance that serves it, so a plugin works with several instances at once", async () => {
			const cms = instance();
			await call(cms, "GET", "v1/example/private");
			expect(mocks.privateGet).toHaveBeenNthCalledWith(1, expect.objectContaining({ cms }));
			const other = instance();
			await call(other, "GET", "v1/example/private");
			expect(mocks.privateGet).toHaveBeenNthCalledWith(2, expect.objectContaining({ cms: other }));
		});

		it("PLUG-S1 a `signed` route is not wrapped (the route checks for itself)", async () => {
			mocks.verifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Authentication required"));
			expect(await (await call(instance(), "POST", "v1/example/hook")).text()).toBe("public");
			expect(mocks.verifyAdmin).not.toHaveBeenCalled();
		});
	});

	describe("plugin route access kinds", () => {
		it("API-G1 `public-read` needs no login, and refuses anything but a read", async () => {
			mocks.verifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Authentication required"));
			expect((await call(instance(), "GET", "v1/example/feed")).status).toBe(200);
			expect((await call(instance(), "POST", "v1/example/feed")).status).toBe(405);
			expect(mocks.verifyAdmin).not.toHaveBeenCalled();
		});

		it("API-G2 `same-origin-form` needs no login, but the router rejects a cross-origin post", async () => {
			mocks.verifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Authentication required"));
			expect((await call(instance(), "POST", "v1/example/form", { origin: "https://evil.example" })).status).toBe(403);
			expect((await call(instance(), "POST", "v1/example/form", { origin: ORIGIN })).status).toBe(200);
			expect(mocks.verifyAdmin).not.toHaveBeenCalled();
		});
	});

	describe("plugin route collisions", () => {
		it("PLUG-S3 a plugin route identical to a core route is an error naming both sides", async () => {
			const cms = instance({ plugin: "evil", routes: [{ pattern: "v1/meta", module: { GET: mocks.privateGet } }] });
			await expect(call(cms, "GET", "v1/example/private")).rejects.toThrow(
				/plugins\.evil\.routes\["v1\/meta"\]: collides with the core route "v1\/meta"/,
			);
			expect(mocks.privateGet).not.toHaveBeenCalled();
		});
	});
});
