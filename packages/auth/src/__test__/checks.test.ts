import type { CheckOutcome, DoctorCheck } from "@monti-cms/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { auth } from "../auth";
import { github } from "../github";

/** The checks of the login, run the way `monti doctor` runs them. */

afterEach(() => vi.unstubAllEnvs());

type Env = Record<string, string | undefined>;

const checksOf = (options: Parameters<typeof auth>[0] = { providers: [github()] }) =>
	auth(options).checks as readonly DoctorCheck[];

/** A stand-in for the instance with only what the checks read. */
const fakeCms = (options: { siteUrl?: string; trusted?: boolean } = {}) =>
	({
		site: { config: { site: options.siteUrl ? { url: options.siteUrl } : undefined } },
		isHostTrusted: () => options.trusted ?? true,
	}) as never;

const run = async (
	id: string,
	env: Env = {},
	options: { checks?: readonly DoctorCheck[]; siteUrl?: string; trusted?: boolean } = {},
): Promise<CheckOutcome> => {
	const check = (options.checks ?? checksOf()).find((item) => item.id === id);
	if (!check) throw new Error(`no check ${id}`);
	return check.run({ cms: fakeCms(options), cwd: "/app", env, online: false });
};

const noGithub = () => {
	vi.stubEnv("AUTH_GITHUB_ID", "");
	vi.stubEnv("AUTH_GITHUB_SECRET", "");
	vi.stubEnv("MONTI_ADMIN_GITHUB_ID", "");
};

describe("auth checks for monti doctor", () => {
	it("lists the checks of the login and of GitHub", () => {
		expect(checksOf().map((check) => check.id)).toEqual([
			"providers",
			"github-id",
			"github-secret",
			"admins",
			"site-url",
			"trust-host",
			"callback-url",
		]);
		expect(checksOf().some((check) => check.online)).toBe(false);
	});

	it("warns on a development machine, and fails in production, for a missing GitHub id or secret", async () => {
		noGithub();
		const dev = await run("github-id", { NODE_ENV: "development" });
		expect(dev.status).toBe("warn");
		expect(dev.message).toContain("AUTH_GITHUB_ID");
		expect(dev.message).toContain("development login");
		expect(dev.where).toContain(".env.local");
		expect(dev.fix).toContain("https://github.com/settings/developers");
		expect(dev.fix).toContain("/api/cms/auth/callback/github");
		expect((await run("github-id", { NODE_ENV: "production" })).status).toBe("fail");
		expect((await run("github-secret", { NODE_ENV: "production" })).message).toContain("AUTH_GITHUB_SECRET");

		vi.stubEnv("AUTH_GITHUB_ID", "Iv1.abc");
		vi.stubEnv("AUTH_GITHUB_SECRET", "shh");
		expect((await run("github-id")).status).toBe("ok");
		expect((await run("github-secret")).status).toBe("ok");
	});

	it("does not print the GitHub secret", async () => {
		noGithub();
		vi.stubEnv("AUTH_GITHUB_SECRET", "super-secret-value");
		const result = await run("github-secret");
		expect(JSON.stringify(result)).not.toContain("super-secret-value");
	});

	describe("admins", () => {
		it("warns for no admin outside production, fails in production, and says how to find the id", async () => {
			noGithub();
			const dev = await run("admins");
			expect(dev.status).toBe("warn");
			expect(dev.where).toBe("MONTI_ADMIN_GITHUB_ID");
			expect(dev.fix).toContain("api.github.com/users/<your-github-login>");
			expect((await run("admins", { NODE_ENV: "production" })).status).toBe("fail");
		});

		it("lists the admins it found, in their qualified form", async () => {
			noGithub();
			vi.stubEnv("MONTI_ADMIN_GITHUB_ID", "12345678, 87654321");
			const result = await run("admins");
			expect(result.status).toBe("ok");
			expect(result.message).toContain("2 admins: github:12345678, github:87654321");
		});

		it("warns about an entry that is a login and not an id, and says what to use", async () => {
			noGithub();
			vi.stubEnv("MONTI_ADMIN_GITHUB_ID", "octocat,12345678");
			const result = await run("admins");
			expect(result.status).toBe("warn");
			expect(result.message).toContain("not an account id");
			expect(result.fix).toContain('"octocat"');
			expect(result.fix).toContain("api.github.com/users");
		});

		it("fails for an admin listed under the wrong provider, naming both", async () => {
			noGithub();
			const checks = checksOf({ providers: [github({ admins: ["gitlab:1"] })] });
			// `gitlab` is not a provider here, so the entry is a plain id that GitHub cannot read as a number.
			expect((await run("admins", {}, { checks })).status).toBe("warn");
			const wrong = checksOf({ providers: [github()], admins: ["nope"] });
			const result = await run("admins", {}, { checks: wrong });
			expect(result.status).toBe("fail");
			expect(result.message).toContain("must be a qualified account id");
			expect(result.message).toContain("github:<id>");
		});
	});

	describe("site URL and callback URL", () => {
		it("is fine without SITE_URL on a development machine and warns where it is deployed", async () => {
			expect((await run("site-url", { NODE_ENV: "development" })).status).toBe("ok");
			const deployed = await run("site-url", { NODE_ENV: "production" });
			expect(deployed.status).toBe("warn");
			expect(deployed.fix).toContain("SITE_URL=https://");
			const onVercel = await run("site-url", { VERCEL: "1" });
			expect(onVercel.status).toBe("warn");
		});

		it("rejects an address that is not a URL and a localhost address on a deployed server", async () => {
			expect((await run("site-url", { SITE_URL: "blog.example.com" })).status).toBe("fail");
			expect((await run("site-url", { SITE_URL: "http://localhost:3000", NODE_ENV: "production" })).status).toBe(
				"warn",
			);
			expect(await run("site-url", { SITE_URL: "https://blog.example.com" })).toMatchObject({
				status: "ok",
				message: "https://blog.example.com",
			});
		});

		it("prints the callback URL to register, from SITE_URL, from the site's own URL, and from the dev server address", async () => {
			const fromEnv = await run("callback-url", { SITE_URL: "https://blog.example.com" });
			expect(fromEnv.message).toContain("GitHub: https://blog.example.com/api/cms/auth/callback/github");
			expect(fromEnv.message).toContain("SITE_URL");
			const fromSite = await run("callback-url", {}, { siteUrl: "https://site.example.com/" });
			expect(fromSite.message).toContain("https://site.example.com/api/cms/auth/callback/github");
			const fallback = await run("callback-url", {});
			expect(fallback.message).toContain("http://localhost:3000/api/cms/auth/callback/github");
			expect(fallback.message).toContain("SITE_URL is not set");
		});

		it("follows a login path that is not the default", async () => {
			const checks = checksOf({ providers: [github()], basePath: "/api/auth" });
			const result = await run("callback-url", { SITE_URL: "https://blog.example.com" }, { checks });
			expect(result.message).toContain("https://blog.example.com/api/auth/callback/github");
		});

		it("warns when AUTH_URL and SITE_URL are different addresses, since login uses AUTH_URL", async () => {
			const result = await run("callback-url", {
				SITE_URL: "https://blog.example.com",
				AUTH_URL: "https://auth.example.com",
			});
			expect(result.status).toBe("warn");
			expect(result.fix).toContain("https://auth.example.com/api/cms/auth/callback/github");
		});
	});

	describe("host trust", () => {
		it("reports the result and why", async () => {
			const dev = await run("trust-host", { NODE_ENV: "development" }, { trusted: true });
			expect(dev.status).toBe("ok");
			expect(dev.message).toContain("NODE_ENV is not production");
			const vercel = await run("trust-host", { NODE_ENV: "production", VERCEL: "1" }, { trusted: true });
			expect(vercel.message).toContain("VERCEL is set");
			const flag = await run("trust-host", { NODE_ENV: "production", AUTH_TRUST_HOST: "true" }, { trusted: true });
			expect(flag.message).toContain("AUTH_TRUST_HOST=true");
		});

		it("warns in production when the host is not trusted and nothing pins the address", async () => {
			const result = await run("trust-host", { NODE_ENV: "production" }, { trusted: false });
			expect(result.status).toBe("warn");
			expect(result.message).toContain("UntrustedHost");
			expect(result.fix).toContain("AUTH_TRUST_HOST=true");
			expect(result.fix).toContain("AUTH_URL");
			expect(
				(await run("trust-host", { NODE_ENV: "production", AUTH_URL: "https://blog.example.com" }, { trusted: false }))
					.status,
			).toBe("ok");
		});
	});
});

describe("auth errors say what, where and how to fix", () => {
	const message = (fn: () => unknown): string => {
		try {
			fn();
		} catch (error) {
			return (error as Error).message;
		}
		return "";
	};

	it("auth() without a provider", () => {
		const text = message(() => auth({ providers: [] }));
		expect(text).toContain("no provider");
		expect(text).toContain("providers");
		expect(text).toContain("auth({ providers: [github()] })");
	});

	it("GitHub without a client id names the variable, the file and the OAuth app steps", () => {
		noGithub();
		const text = message(() => github().requireConfigured?.());
		expect(text).toContain("AUTH_GITHUB_ID");
		expect(text).toMatch(/Where: .*\.env\.local/);
		expect(text).toContain("Fix:");
		expect(text).toContain("github.com/settings/developers");
		expect(text).toContain("monti doctor");
	});

	it("GitHub without a client secret names its variable", () => {
		noGithub();
		vi.stubEnv("AUTH_GITHUB_ID", "id");
		const text = message(() => github().requireConfigured?.());
		expect(text).toContain("AUTH_GITHUB_SECRET");
		expect(text).toContain("Fix:");
	});
});
