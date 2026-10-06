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
import { githubAuth } from "../github";

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

	it("isDevAuthBypassEnabled is true only in development with the option on", () => {
		const development = { NODE_ENV: "development" };
		expect(isDevAuthBypassEnabled(true, development)).toBe(true);
		expect(isDevAuthBypassEnabled(false, development)).toBe(false);
		expect(isDevAuthBypassEnabled(undefined, development)).toBe(false);

		// Ignored in production even if switched on (fail-closed)
		expect(isDevAuthBypassEnabled(true, { NODE_ENV: "production" })).toBe(false);
		expect(isDevAuthBypassEnabled(true, {})).toBe(false);
	});

	it("isDevAuthBypassEnabled is off in a development-mode process that looks deployed", () => {
		expect(isDevAuthBypassEnabled(true, { NODE_ENV: "development", VERCEL: "1" })).toBe(false);
		expect(isDevAuthBypassEnabled(true, { NODE_ENV: "development", KUBERNETES_SERVICE_HOST: "10.0.0.1" })).toBe(false);
		expect(isDevAuthBypassEnabled(true, { NODE_ENV: "development", AUTH_URL: "https://staging.example.com" })).toBe(
			false,
		);
		// A local AUTH_URL is what a developer sets.
		expect(isDevAuthBypassEnabled(true, { NODE_ENV: "development", AUTH_URL: "http://localhost:3000" })).toBe(true);
	});

	it("assertDevBypassSafe refuses a deployed-looking development process and only warns in other modes", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		expect(() => assertDevBypassSafe(true, { NODE_ENV: "development", VERCEL: "1" })).toThrow(/Refusing to start/);
		expect(() => assertDevBypassSafe(true, { NODE_ENV: "development" })).not.toThrow();
		expect(() => assertDevBypassSafe(false, { NODE_ENV: "development", VERCEL: "1" })).not.toThrow();
		// Production ignores the flag instead of failing, and says so.
		expect(() => assertDevBypassSafe(true, { NODE_ENV: "production" })).not.toThrow();
		expect(warn).toHaveBeenCalledOnce();
		warn.mockRestore();
	});

	it("githubAuth applies the dev bypass only in development", () => {
		vi.stubEnv("NODE_ENV", "development");
		const auth = githubAuth({ clientId: "id", clientSecret: "secret", adminIds: [ADMIN_ID], devBypass: true }).create({
			loginPath: "/admin/login",
			trustHost: false,
		});
		expect(auth.devBypass).toBe(true);
		expect(auth.devUserId).toBe(ADMIN_ID);
		vi.stubEnv("NODE_ENV", "production");
		expect(auth.devBypass).toBe(false);
		expect(auth.isAdmin(ADMIN_ID)).toBe(true);
		expect(auth.isAdmin("1")).toBe(false);
	});

	it("githubAuth refuses to build the login connection with devBypass on a deployed-looking development server", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("VERCEL", "1");
		const adapter = githubAuth({ clientId: "id", clientSecret: "secret", adminIds: [ADMIN_ID], devBypass: true });
		expect(() => adapter.create({ loginPath: "/admin/login", trustHost: false })).toThrow(/Refusing to start/);
		// Without the flag the same server starts normally.
		const withoutBypass = githubAuth({ clientId: "id", clientSecret: "secret", adminIds: [ADMIN_ID] });
		expect(() => withoutBypass.create({ loginPath: "/admin/login", trustHost: false })).not.toThrow();
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
