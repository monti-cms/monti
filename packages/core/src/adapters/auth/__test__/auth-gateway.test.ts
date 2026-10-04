import { afterEach, describe, expect, it, vi } from "vitest";
import type { CmsAuth } from "../../../server/define";
import { AuthError, CmsAuthGateway, isAllowedAdminId, isDevAuthBypassEnabled } from "../auth-gateway";
import { githubAuth } from "../github";

const ADMIN_ID = "12345678";

/** 세션만 바꿔 끼우는 로그인 연결. 관리자 판정은 실제 `isAllowedAdminId`를 쓴다. */
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

const gatewayOf = (auth: CmsAuth) => new CmsAuthGateway(() => auth);

async function expectAuthError(promise: Promise<unknown>, code: AuthError["code"]) {
	await expect(promise).rejects.toThrow(AuthError);
	await promise.catch((err) => expect((err as AuthError).code).toBe(code));
}

describe("M2-BE-1 AuthGateway Contract", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
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
		vi.stubEnv("NODE_ENV", "development");
		expect(isDevAuthBypassEnabled(true)).toBe(true);
		expect(isDevAuthBypassEnabled(false)).toBe(false);
		expect(isDevAuthBypassEnabled(undefined)).toBe(false);

		// production 에서는 켜져 있어도 무시 (fail-closed)
		vi.stubEnv("NODE_ENV", "production");
		expect(isDevAuthBypassEnabled(true)).toBe(false);
	});

	it("githubAuth applies the dev bypass only in development", () => {
		const auth = githubAuth({ clientId: "id", clientSecret: "secret", adminIds: [ADMIN_ID], devBypass: true }).create({
			loginPath: "/admin/login",
		});
		vi.stubEnv("NODE_ENV", "development");
		expect(auth.devBypass).toBe(true);
		expect(auth.devUserId).toBe(ADMIN_ID);
		vi.stubEnv("NODE_ENV", "production");
		expect(auth.devBypass).toBe(false);
		expect(auth.isAdmin(ADMIN_ID)).toBe(true);
		expect(auth.isAdmin("1")).toBe(false);
	});

	it("verifyAdmin bypasses session check when dev bypass is enabled", async () => {
		const auth = fakeAuth(null, { devBypass: true });
		const result = await gatewayOf(auth).verifyAdmin();
		expect(result).toEqual({ userId: ADMIN_ID, accountId: ADMIN_ID, isAdmin: true });
		expect(auth.session).not.toHaveBeenCalled();
	});
});
