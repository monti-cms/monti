import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "../../adapters/auth";
import { fakeCms } from "../../cms";
import type { PluginRoute } from "../../plugin/define";
import type { RouteContext } from "../v1/handler";

const mocks = vi.hoisted(() => ({
	verifyAdmin: vi.fn(),
	privateGet: vi.fn(async (_request: Request, _context: RouteContext) => new Response("private")),
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
					{ pattern: "v1/example/hook", module: { POST: mocks.publicPost }, public: true },
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
	cms.routeHandler()[method](
		new NextRequest(`${ORIGIN}/api/cms/${path}`, {
			method,
			headers: { "content-type": "application/json", ...headers },
			...(method === "POST" ? { body: "{}" } : {}),
		}),
		{ params: Promise.resolve({ path: path.split("/") }) },
	);

beforeEach(() => {
	vi.clearAllMocks();
	mocks.verifyAdmin.mockResolvedValue({ userId: "u", accountId: "g", isAdmin: true });
});

describe("plugin API route default authentication", () => {
	it("when not logged in, does not call the plugin route and returns 401", async () => {
		mocks.verifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Authentication required"));
		expect((await call(instance(), "GET", "v1/example/private")).status).toBe(401);
		expect(mocks.privateGet).not.toHaveBeenCalled();
	});

	it("rejects a cross-origin change request before the login check", async () => {
		const response = await call(instance(), "POST", "v1/example/private", { origin: "https://evil.example.com" });
		expect(response.status).toBe(403);
		expect(mocks.verifyAdmin).not.toHaveBeenCalled();
		expect(mocks.privateGet).not.toHaveBeenCalled();
	});

	it("an admin reaches the plugin route", async () => {
		expect(await (await call(instance(), "POST", "v1/example/private", { origin: ORIGIN })).text()).toBe("private");
		expect(mocks.verifyAdmin).toHaveBeenCalledTimes(1);
	});

	it("a plugin route gets the instance that serves it, so a plugin works with several instances at once", async () => {
		const cms = instance();
		await call(cms, "GET", "v1/example/private");
		expect(mocks.privateGet.mock.calls[0]?.[1].cms).toBe(cms);
		const other = instance();
		await call(other, "GET", "v1/example/private");
		expect(mocks.privateGet.mock.calls[1]?.[1].cms).toBe(other);
	});

	it("a `public: true` route is not wrapped (the route checks for itself)", async () => {
		mocks.verifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Authentication required"));
		expect(await (await call(instance(), "POST", "v1/example/hook")).text()).toBe("public");
		expect(mocks.verifyAdmin).not.toHaveBeenCalled();
	});
});

describe("plugin route collisions", () => {
	it("a plugin route identical to a core route is an error naming both sides", async () => {
		const cms = instance({ plugin: "evil", routes: [{ pattern: "v1/meta", module: { GET: mocks.privateGet } }] });
		await expect(call(cms, "GET", "v1/example/private")).rejects.toThrow(
			/route "v1\/meta" of plugin "evil" collides with the core route "v1\/meta"/,
		);
		expect(mocks.privateGet).not.toHaveBeenCalled();
	});

	it("a route identical to another plugin's is also an error", async () => {
		const cms = instance({
			plugin: "other",
			routes: [{ pattern: "v1/example/private", module: { GET: mocks.privateGet } }],
		});
		await expect(call(cms, "GET", "v1/example/private")).rejects.toThrow(
			/of plugin "other" collides with the route "v1\/example\/private" of plugin "example"/,
		);
	});

	it("works when there is no collision", async () => {
		expect((await call(instance(), "GET", "v1/example/private")).status).toBe(200);
	});
});
