import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	verifyAdmin: vi.fn(),
	privateGet: vi.fn(async () => new Response("private")),
	publicPost: vi.fn(async () => new Response("public")),
	extra: [] as { plugin: string; pattern: string; module: object }[],
}));

vi.mock("../../adapters/auth", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../adapters/auth")>()),
	authGateway: { verifyAdmin: () => mocks.verifyAdmin() },
}));

vi.mock("../../plugin/server", () => ({
	pluginRoutes: async () => [
		{ plugin: "example", pattern: "v1/example/private", module: { GET: mocks.privateGet, POST: mocks.privateGet } },
		{ plugin: "example", pattern: "v1/example/hook", module: { POST: mocks.publicPost }, public: true },
		...mocks.extra,
	],
}));

import { AuthError } from "../../adapters/auth";
import { createCmsRouteHandler } from "../router";

const ORIGIN = "http://localhost";
const call = (method: "GET" | "POST", path: string, headers: Record<string, string> = {}) =>
	createCmsRouteHandler()[method](
		new NextRequest(`${ORIGIN}/api/cms/${path}`, {
			method,
			headers: { "content-type": "application/json", ...headers },
			...(method === "POST" ? { body: "{}" } : {}),
		}),
		{ params: Promise.resolve({ path: path.split("/") }) },
	);

beforeEach(() => {
	vi.clearAllMocks();
	mocks.extra = [];
	mocks.verifyAdmin.mockResolvedValue({ userId: "u", accountId: "g", isAdmin: true });
});

describe("plugin API route default authentication", () => {
	it("when not logged in, does not call the plugin route and returns 401", async () => {
		mocks.verifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Authentication required"));
		expect((await call("GET", "v1/example/private")).status).toBe(401);
		expect(mocks.privateGet).not.toHaveBeenCalled();
	});

	it("rejects a cross-origin change request before the login check", async () => {
		const response = await call("POST", "v1/example/private", { origin: "https://evil.example.com" });
		expect(response.status).toBe(403);
		expect(mocks.verifyAdmin).not.toHaveBeenCalled();
		expect(mocks.privateGet).not.toHaveBeenCalled();
	});

	it("an admin reaches the plugin route", async () => {
		expect(await (await call("POST", "v1/example/private", { origin: ORIGIN })).text()).toBe("private");
		expect(mocks.verifyAdmin).toHaveBeenCalledTimes(1);
	});

	it("a `public: true` route is not wrapped (the route checks for itself)", async () => {
		mocks.verifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Authentication required"));
		expect(await (await call("POST", "v1/example/hook")).text()).toBe("public");
		expect(mocks.verifyAdmin).not.toHaveBeenCalled();
	});
});

describe("plugin route collisions", () => {
	// The route table is built once and cached, so re-read the router for each test.
	const callFresh = async (path: string) => {
		vi.resetModules();
		const { createCmsRouteHandler: fresh } = await import("../router");
		return fresh().GET(new NextRequest(`${ORIGIN}/api/cms/${path}`), {
			params: Promise.resolve({ path: path.split("/") }),
		});
	};

	it("a plugin route identical to a core route is an error naming both sides", async () => {
		mocks.extra = [{ plugin: "evil", pattern: "v1/meta", module: { GET: mocks.privateGet } }];
		await expect(callFresh("v1/example/private")).rejects.toThrow(
			/route "v1\/meta" of plugin "evil" collides with the core route "v1\/meta"/,
		);
		expect(mocks.privateGet).not.toHaveBeenCalled();
	});

	it("a route identical to another plugin's is also an error", async () => {
		mocks.extra = [{ plugin: "other", pattern: "v1/example/private", module: { GET: mocks.privateGet } }];
		await expect(callFresh("v1/example/private")).rejects.toThrow(
			/of plugin "other" collides with the route "v1\/example\/private" of plugin "example"/,
		);
	});

	it("works when there is no collision", async () => {
		expect((await callFresh("v1/example/private")).status).toBe(200);
	});
});
