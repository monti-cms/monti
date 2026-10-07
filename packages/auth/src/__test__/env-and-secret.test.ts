import { CmsAuthGateway } from "@monti-cms/core/adapters/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { github } from "../github";
import { connect, connectWithEnv, loginThrough, requestWith, stubOAuthServers } from "./harness";

const ADMIN_ID = "12345678";
const githubServer = {
	tokenUrl: "https://github.com/login/oauth/access_token",
	userUrl: "https://api.github.com/user",
	user: { id: Number(ADMIN_ID), login: "mina", name: "Mina Park", email: null },
};

beforeEach(() => {
	for (const name of [
		"AUTH_GITHUB_ID",
		"AUTH_GITHUB_SECRET",
		"MONTI_ADMIN_GITHUB_ID",
		"AUTH_SECRET",
		"CMS_ADMIN_GITHUB_ID",
	]) {
		vi.stubEnv(name, "");
	}
});
afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("github() reads the conventional environment variables", () => {
	it("works with no arguments: the OAuth app from AUTH_GITHUB_ID and AUTH_GITHUB_SECRET", async () => {
		vi.stubEnv("AUTH_GITHUB_ID", "env-id");
		vi.stubEnv("AUTH_GITHUB_SECRET", "env-secret");
		vi.stubEnv("MONTI_ADMIN_GITHUB_ID", ADMIN_ID);
		stubOAuthServers(githubServer);
		const cmsAuth = connectWithEnv({ providers: [github()] });
		const { authorize, jar } = await loginThrough(cmsAuth, "github");
		expect(authorize.searchParams.get("client_id")).toBe("env-id");
		expect(cmsAuth.isAdmin(`github:${ADMIN_ID}`)).toBe(true);
		expect((await cmsAuth.session(requestWith(jar)))?.user?.accountId).toBe(`github:${ADMIN_ID}`);
	});

	it("lets explicit values win over the environment", async () => {
		vi.stubEnv("AUTH_GITHUB_ID", "env-id");
		vi.stubEnv("AUTH_GITHUB_SECRET", "env-secret");
		vi.stubEnv("MONTI_ADMIN_GITHUB_ID", "1");
		stubOAuthServers(githubServer);
		const cmsAuth = connectWithEnv({
			providers: [github({ clientId: "explicit-id", clientSecret: "explicit-secret", admins: [ADMIN_ID] })],
		});
		const { authorize } = await loginThrough(cmsAuth, "github");
		expect(authorize.searchParams.get("client_id")).toBe("explicit-id");
		expect(cmsAuth.isAdmin(`github:${ADMIN_ID}`)).toBe(true);
		expect(cmsAuth.isAdmin("github:1")).toBe(false);
	});

	it("takes several admins from MONTI_ADMIN_GITHUB_ID, separated by commas", () => {
		vi.stubEnv("MONTI_ADMIN_GITHUB_ID", `${ADMIN_ID}, 77`);
		const cmsAuth = connect({ providers: [github()] });
		expect(cmsAuth.isAdmin(`github:${ADMIN_ID}`)).toBe(true);
		expect(cmsAuth.isAdmin("github:77")).toBe(true);
		expect(cmsAuth.isAdmin("github:78")).toBe(false);
	});

	it("never guesses from other names", () => {
		vi.stubEnv("CMS_ADMIN_GITHUB_ID", ADMIN_ID);
		vi.stubEnv("GITHUB_ID", "other");
		vi.stubEnv("GITHUB_CLIENT_ID", "other");
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		expect(() => connectWithEnv({ providers: [github()] })).toThrow(/AUTH_GITHUB_ID/);
		const cmsAuth = connect({ providers: [github()] });
		expect(cmsAuth.isAdmin(`github:${ADMIN_ID}`)).toBe(false);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("MONTI_ADMIN_GITHUB_ID"));
	});

	it("says which variable is missing", () => {
		vi.stubEnv("AUTH_GITHUB_SECRET", "env-secret");
		expect(() => connectWithEnv({ providers: [github()] })).toThrow(
			/`AUTH_GITHUB_ID` is empty; set it.*or pass `github\(\{ clientId \}\)`/,
		);
		vi.stubEnv("AUTH_GITHUB_ID", "env-id");
		vi.stubEnv("AUTH_GITHUB_SECRET", "");
		expect(() => connectWithEnv({ providers: [github()] })).toThrow(
			/`AUTH_GITHUB_SECRET` is empty; set it.*or pass `github\(\{ clientSecret \}\)`/,
		);
	});

	it("does not need the GitHub app to start under the development bypass, and asks for it when a sign-in is attempted", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const cmsAuth = connectWithEnv({ providers: [github()] });
		await expect(
			cmsAuth.signIn("github", { request: new Request("http://localhost:3000/x", { method: "POST" }) }),
		).rejects.toThrow(/AUTH_GITHUB_ID/);
	});
});

describe("the one secret, MONTI_SECRET", () => {
	const options = { providers: [github({ clientId: "id", clientSecret: "secret", admins: [ADMIN_ID] })] };

	it("is required, and the error names it", async () => {
		const { createSecretsVault } = await import("@monti-cms/core/testing");
		expect(() => connect(options, { secrets: createSecretsVault({}).forPlugin("auth") })).toThrow(/MONTI_SECRET/);
	});

	it("signs the session with a key derived from it: the same secret reads a session, another secret does not", async () => {
		const { createSecretsVault } = await import("@monti-cms/core/testing");
		const withSecret = (secret: string) =>
			connect(options, { secrets: createSecretsVault({ secret }).forPlugin("auth") });
		stubOAuthServers(githubServer);
		const { jar } = await loginThrough(withSecret("secret-one-secret-one-secret-one"), "github");
		expect((await withSecret("secret-one-secret-one-secret-one").session(requestWith(jar)))?.user?.accountId).toBe(
			`github:${ADMIN_ID}`,
		);
		expect(await withSecret("secret-two-secret-two-secret-two").session(requestWith(jar))).toBeNull();
	});

	it("does not read AUTH_SECRET any more", async () => {
		vi.stubEnv("AUTH_SECRET", "legacy-secret-legacy-secret-legacy");
		const { createSecretsVault } = await import("@monti-cms/core/testing");
		expect(() => connect(options, { secrets: createSecretsVault({}).forPlugin("auth") })).toThrow(/MONTI_SECRET/);
	});
});

describe("the request host", () => {
	const loopback = new Headers({ host: "localhost:3000", "x-forwarded-for": "::1" });
	const other = new Headers({ host: "staging.example.com" });
	const admin = { providers: [github({ clientId: "id", clientSecret: "secret", admins: [ADMIN_ID] })] };

	it("is the one the framework integration attached to the instance, so auth() needs no host", async () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const cmsAuth = connect(admin, { host: { requestHeaders: async () => loopback } });
		expect(await new CmsAuthGateway(() => cmsAuth).verifyAdmin()).toMatchObject({ isAdmin: true });
	});

	it("is the explicit `host` of auth() when one is given, which wins over the attached one", async () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const cmsAuth = connect(
			{ ...admin, host: { requestHeaders: async () => other } },
			{ host: { requestHeaders: async () => loopback } },
		);
		await expect(new CmsAuthGateway(() => cmsAuth).verifyAdmin()).rejects.toMatchObject({ code: "unauthorized" });
	});
});
