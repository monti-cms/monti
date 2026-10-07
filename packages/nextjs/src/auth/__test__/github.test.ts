import { afterEach, describe, expect, it, vi } from "vitest";
import { CMS_AUTH_BASE_PATH } from "../../../server/define";
import { githubAuthConfig } from "../auth-config";
import { githubAuth } from "../github";

// NextAuth itself reads Next server modules, so only the config shape is checked.
vi.mock("next-auth", () => ({ default: vi.fn() }));
vi.mock("next-auth/providers/github", () => ({ default: (options: object) => ({ id: "github", ...options }) }));

afterEach(() => {
	vi.unstubAllEnvs();
});

const credentials = { clientId: "id", clientSecret: "secret", adminIds: ["1"] };

describe("GitHub login path", () => {
	it("the login API is under the admin API by default (`/api/cms/auth`), and the old path can be chosen", () => {
		expect(githubAuth(credentials).create({ loginPath: "/admin/login", trustHost: false }).basePath).toBe(
			CMS_AUTH_BASE_PATH,
		);
		expect(
			githubAuth({ ...credentials, basePath: "/api/auth/" }).create({ loginPath: "/admin/login", trustHost: false })
				.basePath,
		).toBe("/api/auth");
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
