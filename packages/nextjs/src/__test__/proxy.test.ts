import { describe, expect, it, vi } from "vitest";
import { cmsProxy, loginProblem, setupResponse } from "../proxy";

const site = { ADMIN_PATH: "/studio", config: { site: { previewPath: "/preview" } } };
const broken = {
	site,
	auth: () => {
		throw new Error("AUTH_GITHUB_ID is not set, so GitHub login cannot start");
	},
};
const healthy = { site, auth: () => ({}) };
const at = (pathname: string) => ({ nextUrl: { pathname } }) as never;
const PRODUCTION = { NODE_ENV: "production" };

describe("the proxy that answers for a site whose login is not set up", () => {
	it("answers 503 with a page that points to monti doctor, for the admin and the draft preview, in production", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		for (const pathname of ["/studio", "/studio/entries/1/edit", "/preview/posts/hello"]) {
			const response = setupResponse(at(pathname), broken as never, PRODUCTION);
			expect(response?.status, pathname).toBe(503);
			expect(response?.headers.get("content-type")).toContain("text/html");
			expect(response?.headers.get("cache-control")).toBe("no-store");
			const text = await response?.text();
			expect(text).toContain("monti doctor");
			// The public page names no setting.
			expect(text).not.toContain("AUTH_GITHUB_ID");
		}
		vi.restoreAllMocks();
	});

	it("logs the full problem once, for the person who runs the server", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
		delete (globalThis as Record<symbol, unknown>)[Symbol.for("monti.setup-response.reported")];
		setupResponse(at("/studio"), broken as never, PRODUCTION);
		setupResponse(at("/studio"), broken as never, PRODUCTION);
		expect(error).toHaveBeenCalledTimes(1);
		expect(String(error.mock.calls[0]?.[0])).toContain("AUTH_GITHUB_ID is not set");
		vi.restoreAllMocks();
	});

	it("leaves the public pages alone", () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		for (const pathname of ["/", "/posts", "/posts/hello", "/studiolike", "/previews"]) {
			expect(setupResponse(at(pathname), broken as never, PRODUCTION), pathname).toBeUndefined();
		}
		vi.restoreAllMocks();
	});

	it("does nothing when the login is set up, and nothing outside production", () => {
		expect(setupResponse(at("/studio"), healthy as never, PRODUCTION)).toBeUndefined();
		expect(setupResponse(at("/studio"), broken as never, { NODE_ENV: "development" })).toBeUndefined();
		expect(loginProblem(broken as never, { NODE_ENV: "test" })).toBeUndefined();
		expect(loginProblem(broken as never, PRODUCTION)).toMatch(/AUTH_GITHUB_ID/);
	});

	it("cmsProxy lets every other request through", () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		const proxy = cmsProxy(broken as never);
		expect(proxy(at("/studio")).status).toBe(503);
		expect(proxy(at("/posts")).headers.get("x-middleware-next")).toBe("1");
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});
});
