import { createSite } from "@monti-cms/core/client";
import { CMS_AUTH_BASE_PATH } from "@monti-cms/core/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../../core/test/site";
import { githubAuthConfig } from "../auth-config";
import { githubAuth } from "../github";

// NextAuth itself reads Next server modules, so only the config shape is checked.
vi.mock("next-auth", () => ({ default: vi.fn() }));
vi.mock("next-auth/providers/github", () => ({ default: (options: object) => ({ id: "github", ...options }) }));

afterEach(() => {
	vi.unstubAllEnvs();
});

const credentials = { clientId: "id", clientSecret: "secret", adminIds: ["1"] };
const ADMIN_ID = "12345678";
const site = createSite(testConfig);
const context = { site, loginPath: "/admin/login", trustHost: false };

describe("GitHub login path", () => {
	it("the login API is under the admin API by default (`/api/cms/auth`), and the old path can be chosen", () => {
		expect(githubAuth(credentials).create(context).basePath).toBe(CMS_AUTH_BASE_PATH);
		expect(githubAuth({ ...credentials, basePath: "/api/auth/" }).create(context).basePath).toBe("/api/auth");
	});

	it("puts the login API path and the admin login page URL into the NextAuth config", () => {
		const config = githubAuthConfig({
			clientId: "id",
			clientSecret: "secret",
			basePath: "/api/cms/auth",
			signInPage: "/studio/login",
		});
		expect(config.basePath).toBe("/api/cms/auth");
		expect(config.pages?.signIn).toBe("/studio/login");
		// Without a signing value, leave it empty so NextAuth reads AUTH_SECRET.
		expect(config.secret).toBeUndefined();
	});

	it("does not trust the request host unless told to", () => {
		const base = { clientId: "id", clientSecret: "secret", basePath: "/api/cms/auth", signInPage: "/admin/login" };
		vi.stubEnv("AUTH_URL", "");
		vi.stubEnv("NEXTAUTH_URL", "");
		expect(githubAuthConfig(base).trustHost).toBe(false);
		expect(githubAuthConfig({ ...base, trustHost: true }).trustHost).toBe(true);
	});

	it("needs no host trust once AUTH_URL pins the origin", () => {
		vi.stubEnv("AUTH_URL", "https://cms.example.com");
		const config = githubAuthConfig({
			clientId: "id",
			clientSecret: "secret",
			basePath: "/api/cms/auth",
			signInPage: "/admin/login",
		});
		expect(config.trustHost).toBe(true);
	});

	it("passes a login signing value to NextAuth (separate from the stored-value encryption key)", () => {
		const config = githubAuthConfig({
			clientId: "id",
			clientSecret: "secret",
			basePath: "/api/cms/auth",
			signInPage: "/admin/login",
			secret: "login-only",
		});
		expect(config.secret).toBe("login-only");
	});
});

describe("GitHub login connection", () => {
	it("offers one login method, GitHub, with a button label", () => {
		const auth = githubAuth(credentials).create(context);
		expect(auth.providers).toHaveLength(1);
		expect(auth.providers[0]).toMatchObject({ id: "github", name: "GitHub" });
		expect(auth.providers[0]?.label).toBeTruthy();
	});

	it("applies the dev bypass only in development", () => {
		vi.stubEnv("NODE_ENV", "development");
		const auth = githubAuth({ ...credentials, adminIds: [ADMIN_ID], devBypass: true }).create(context);
		expect(auth.devBypass).toBe(true);
		expect(auth.devUserId).toBe(ADMIN_ID);
		vi.stubEnv("NODE_ENV", "production");
		expect(auth.devBypass).toBe(false);
		expect(auth.isAdmin(ADMIN_ID)).toBe(true);
		expect(auth.isAdmin("1")).toBe(false);
	});

	it("refuses to build the login connection with devBypass on a deployed-looking development server", () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("VERCEL", "1");
		const adapter = githubAuth({ ...credentials, adminIds: [ADMIN_ID], devBypass: true });
		expect(() => adapter.create(context)).toThrow(/Refusing to start/);
		// Without the flag the same server starts normally.
		expect(() => githubAuth({ ...credentials, adminIds: [ADMIN_ID] }).create(context)).not.toThrow();
	});

	it("reads no request headers outside a request, so the dev bypass never applies there", async () => {
		const auth = githubAuth(credentials).create(context);
		expect(await auth.requestHeaders?.()).toBeNull();
	});

	it("passes an error that is not a Next signal through untouched", () => {
		const auth = githubAuth(credentials).create(context);
		expect(() => auth.rethrow?.(new Error("provider is down"))).not.toThrow();
	});
});
