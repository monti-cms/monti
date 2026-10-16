import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "../../adapters/auth";
import { fakeCms } from "../../cms";
import type { PluginRoute } from "../../plugin/define";
import type { AdminRequest } from "../v1/handler";

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
		expect(mocks.privateGet.mock.calls[0]?.[0].cms).toBe(cms);
		const other = instance();
		await call(other, "GET", "v1/example/private");
		expect(mocks.privateGet.mock.calls[1]?.[0].cms).toBe(other);
	});

	it("a `signed` route is not wrapped (the route checks for itself)", async () => {
		mocks.verifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Authentication required"));
		expect(await (await call(instance(), "POST", "v1/example/hook")).text()).toBe("public");
		expect(mocks.verifyAdmin).not.toHaveBeenCalled();
	});
});

describe("plugin route access kinds", () => {
	it("`public-read` needs no login, and refuses anything but a read", async () => {
		mocks.verifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Authentication required"));
		expect((await call(instance(), "GET", "v1/example/feed")).status).toBe(200);
		expect((await call(instance(), "POST", "v1/example/feed")).status).toBe(405);
		expect(mocks.verifyAdmin).not.toHaveBeenCalled();
	});

	it("`same-origin-form` needs no login, but the router rejects a cross-origin post", async () => {
		mocks.verifyAdmin.mockRejectedValue(new AuthError("unauthorized", "Authentication required"));
		expect((await call(instance(), "POST", "v1/example/form", { origin: "https://evil.example" })).status).toBe(403);
		expect((await call(instance(), "POST", "v1/example/form", { origin: ORIGIN })).status).toBe(200);
		expect(mocks.verifyAdmin).not.toHaveBeenCalled();
	});
});

describe("plugin route collisions", () => {
	it("a plugin route identical to a core route is an error naming both sides", async () => {
		const cms = instance({ plugin: "evil", routes: [{ pattern: "v1/meta", module: { GET: mocks.privateGet } }] });
		await expect(call(cms, "GET", "v1/example/private")).rejects.toThrow(
			/plugins\.evil\.routes\["v1\/meta"\]: collides with the core route "v1\/meta"/,
		);
		expect(mocks.privateGet).not.toHaveBeenCalled();
	});

	it("a route identical to another plugin's is also an error", async () => {
		const cms = instance({
			plugin: "other",
			routes: [{ pattern: "v1/example/private", module: { GET: mocks.privateGet } }],
		});
		await expect(call(cms, "GET", "v1/example/private")).rejects.toThrow(
			/plugins\.other\.routes.*collides with the route "v1\/example\/private" of plugin "example"/,
		);
	});

	it("works when there is no collision", async () => {
		expect((await call(instance(), "GET", "v1/example/private")).status).toBe(200);
	});
});
