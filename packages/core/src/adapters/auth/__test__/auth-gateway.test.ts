import { afterEach, describe, expect, it, vi } from "vitest";
import type { CmsAuth } from "../../../server/define";
import {
	AuthError,
	assertDevBypassSafe,
	CmsAuthGateway,
	isAllowedAdminId,
	isDevAuthBypassEnabled,
	type RequestHeaders,
} from "../auth-gateway";

const ADMIN_ID = "12345678";

/** Login connection that only swaps in the session. The admin check uses the real `isAllowedAdminId`. */
function fakeAuth(session: Awaited<ReturnType<CmsAuth["session"]>>, overrides: Partial<CmsAuth> = {}): CmsAuth {
	return {
		handlers: { GET: vi.fn(), POST: vi.fn() },
		session: vi.fn().mockResolvedValue(session),
		signIn: vi.fn(),
		signOut: vi.fn(),
		isAdmin: (id) => isAllowedAdminId(id, [ADMIN_ID]),
		devBypass: false,
		devUserId: ADMIN_ID,
		providers: [],
		...overrides,
	};
}

/** Headers of a request that reaches the dev server directly on localhost. */
const localRequest: RequestHeaders = async () => new Headers({ host: "localhost:3000", "x-forwarded-for": "::1" });
const gatewayOf = (auth: CmsAuth, requestHeaders: RequestHeaders = localRequest) =>
	new CmsAuthGateway(() => auth, requestHeaders);

async function expectAuthError(promise: Promise<unknown>, code: AuthError["code"]) {
	await expect(promise).rejects.toThrow(AuthError);
	await promise.catch((err) => expect((err as AuthError).code).toBe(code));
}

describe("AuthGateway Contract", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it("isAllowedAdminId compares canonical decimal GitHub IDs", () => {
		expect(isAllowedAdminId("12345678", [ADMIN_ID])).toBe(true);
		expect(isAllowedAdminId("0012345678", [ADMIN_ID])).toBe(true);
		expect(isAllowedAdminId("87654321", [ADMIN_ID])).toBe(false);
		expect(isAllowedAdminId("87654321", [undefined, "87654321"])).toBe(true);
		expect(isAllowedAdminId("", [ADMIN_ID])).toBe(false);
		expect(isAllowedAdminId(undefined, [ADMIN_ID])).toBe(false);
		expect(isAllowedAdminId("12345678", [])).toBe(false);
		expect(isAllowedAdminId("12345678", [undefined, " "])).toBe(false);
		expect(isAllowedAdminId("abc", ["abc"])).toBe(false);
	});

	it("throws unauthorized when no session exists", async () => {
		await expectAuthError(gatewayOf(fakeAuth(null)).verifyAdmin(), "unauthorized");
	});

	it("throws unauthorized when session user has no accountId", async () => {
		await expectAuthError(gatewayOf(fakeAuth({ user: { id: "x" } })).verifyAdmin(), "unauthorized");
	});

	it("throws forbidden when session user accountId is not an admin", async () => {
		await expectAuthError(gatewayOf(fakeAuth({ user: { accountId: "99999999" } })).verifyAdmin(), "forbidden");
	});

	it("returns AuthContext when session user accountId is an admin", async () => {
		const result = await gatewayOf(fakeAuth({ user: { id: ADMIN_ID, accountId: ADMIN_ID } })).verifyAdmin();
		expect(result).toEqual({ userId: ADMIN_ID, accountId: ADMIN_ID, isAdmin: true });
	});

	it("carries the name the login method gave, and leaves it out when there is none", async () => {
		const named = await gatewayOf(
			fakeAuth({ user: { id: ADMIN_ID, accountId: ADMIN_ID, name: " Mina Park " } }),
		).verifyAdmin();
		expect(named.name).toBe("Mina Park");
		const unnamed = await gatewayOf(fakeAuth({ user: { id: ADMIN_ID, accountId: ADMIN_ID, name: " " } })).verifyAdmin();
		expect(unnamed).not.toHaveProperty("name");
	});

	it("isDevAuthBypassEnabled is on by default in development, and can be turned off", () => {
		const development = { NODE_ENV: "development" };
		expect(isDevAuthBypassEnabled(undefined, development)).toBe(true);
		expect(isDevAuthBypassEnabled(true, development)).toBe(true);
		expect(isDevAuthBypassEnabled(false, development)).toBe(false);
	});

	it("isDevAuthBypassEnabled is never on outside development, whatever is asked (fail-closed)", () => {
		for (const env of [{ NODE_ENV: "production" }, { NODE_ENV: "test" }, {}]) {
			expect(isDevAuthBypassEnabled(undefined, env)).toBe(false);
			expect(isDevAuthBypassEnabled(true, env)).toBe(false);
		}
	});

	it("isDevAuthBypassEnabled is off in a development-mode process that looks deployed", () => {
		expect(isDevAuthBypassEnabled(true, { NODE_ENV: "development", VERCEL: "1" })).toBe(false);
		expect(isDevAuthBypassEnabled(true, { NODE_ENV: "development", KUBERNETES_SERVICE_HOST: "10.0.0.1" })).toBe(false);
		expect(isDevAuthBypassEnabled(true, { NODE_ENV: "development", AUTH_URL: "https://staging.example.com" })).toBe(
			false,
		);
		expect(isDevAuthBypassEnabled(undefined, { NODE_ENV: "development", VERCEL: "1" })).toBe(false);
		// A local AUTH_URL is what a developer sets.
		expect(isDevAuthBypassEnabled(true, { NODE_ENV: "development", AUTH_URL: "http://localhost:3000" })).toBe(true);
	});

	it("assertDevBypassSafe refuses a deployed-looking development process and only warns in other modes", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		expect(() => assertDevBypassSafe(true, { NODE_ENV: "development", VERCEL: "1" })).toThrow(/Refusing to start/);
		expect(() => assertDevBypassSafe(true, { NODE_ENV: "development" })).not.toThrow();
		expect(() => assertDevBypassSafe(false, { NODE_ENV: "development", VERCEL: "1" })).not.toThrow();
		// The default (nothing said) is simply off on a deployed-looking process; it does not stop the server from starting.
		expect(() => assertDevBypassSafe(undefined, { NODE_ENV: "development", VERCEL: "1" })).not.toThrow();
		// Production ignores the flag instead of failing, and says so.
		expect(() => assertDevBypassSafe(true, { NODE_ENV: "production" })).not.toThrow();
		expect(warn).toHaveBeenCalledOnce();
		warn.mockRestore();
	});

	it("verifyAdmin bypasses session check for a localhost request when dev bypass is enabled", async () => {
		const auth = fakeAuth(null, { devBypass: true });
		const result = await gatewayOf(auth).verifyAdmin();
		expect(result).toEqual({ userId: ADMIN_ID, accountId: ADMIN_ID, isAdmin: true });
		expect(auth.session).not.toHaveBeenCalled();
	});

	it("verifyAdmin falls back to the normal login for a request that does not come from localhost", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const remote: RequestHeaders[] = [
			async () => new Headers({ host: "staging.example.com" }),
			async () => new Headers({ host: "localhost:3000", "x-forwarded-for": "203.0.113.9" }),
			async () => new Headers({ host: "localhost:3000", "x-forwarded-host": "staging.example.com" }),
			async () => new Headers(),
			async () => null,
		];
		for (const headers of remote) {
			const auth = fakeAuth(null, { devBypass: true });
			await expectAuthError(gatewayOf(auth, headers).verifyAdmin(), "unauthorized");
			expect(auth.session).toHaveBeenCalled();
		}
	});

	it("an admin session still works when the bypass is skipped", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const auth = fakeAuth({ user: { id: ADMIN_ID, accountId: ADMIN_ID } }, { devBypass: true });
		const result = await gatewayOf(auth, async () => new Headers({ host: "staging.example.com" })).verifyAdmin();
		expect(result.accountId).toBe(ADMIN_ID);
	});
});
