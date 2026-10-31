import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../test/site";
import { AuthError } from "../../adapters/auth";
import { fakeCms } from "../../cms";
import { hostOf } from "../../cms/host";
import type { ConfigError } from "../../config/check/issue";
import { createSecretsVault } from "../../secrets";
import { defineConfig } from "../config";
import type { AuthAdapter, DatabaseAdapter, MediaAdapter } from "../define";

const database = {
	name: "fake",
	createStore: vi.fn(),
	migrate: vi.fn(),
	pluginStorage: vi.fn(),
	transaction: vi.fn(),
} satisfies DatabaseAdapter;
const auth: AuthAdapter = { name: "fake", create: () => fakeCms().auth() };
const site = {
	collections: testConfig.collections,
	locales: testConfig.locales,
	defaultLocale: testConfig.defaultLocale,
};

beforeEach(() => {
	for (const name of [
		"MONTI_SECRET",
		"CMS_SECRET",
		"AUTH_SECRET",
		"AUTH_TRUST_HOST",
		"VERCEL",
		"NETLIFY",
		"CF_PAGES",
		"SITE_URL",
	]) {
		vi.stubEnv(name, "");
	}
});
afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("defineConfig: one config, one instance", () => {
	it("CONF-S1 makes the CMS instance from the site options and the server options together", () => {
		const cms = defineConfig({ ...site, database, auth });
		expect(Object.keys(cms.site.config.collections)).toEqual(Object.keys(testConfig.collections));
		expect(cms.server.database).toBe(database);
		expect(cms.isMediaConfigured).toBe(false);
	});

	it("CONF-S1 takes any storage adapter as `storage`", () => {
		const storage = { name: "any-package", createStore: vi.fn() } as unknown as MediaAdapter;
		const cms = defineConfig({ ...site, database, auth, storage });
		expect(cms.isMediaConfigured).toBe(true);
		expect(cms.server.media).toBe(storage);
	});

	it("names what is missing", () => {
		expect(() => defineConfig({ ...site, auth } as never)).toThrow(/database.*postgres\(\)/);
	});

	it("AUTH-L7 boots without `auth`: the dev bypass lets this machine in, and production refuses everyone", async () => {
		const cms = defineConfig({ ...site, database });
		hostOf(cms).attachHost({
			requestHeaders: async () => new Headers({ host: "localhost:3000", "x-forwarded-for": "::1" }),
		});
		expect(cms.auth().providers).toEqual([]);
		expect(
			hostOf(cms)
				.decisions({ NODE_ENV: "production" })
				.find((entry) => entry.topic === "Login")?.value,
		).toBe("none");

		vi.stubEnv("NODE_ENV", "development");
		expect(await hostOf(cms).authGateway.isDevBypassActive()).toBe(true);
		expect(await hostOf(cms).authGateway.verifyAdmin()).toMatchObject({ isAdmin: true });

		vi.stubEnv("NODE_ENV", "production");
		expect(await hostOf(cms).authGateway.isDevBypassActive()).toBe(false);
		await expect(hostOf(cms).authGateway.verifyAdmin()).rejects.toThrow(AuthError);
		const handled = await cms.authHandlers.GET(new Request("http://localhost:3000/api/monti/auth/session"));
		expect(handled.status).toBe(404);
	});

	it("CONF-S2 refuses to load in a browser bundle", () => {
		vi.stubGlobal("window", {});
		expect(() => defineConfig({ ...site, database, auth })).toThrow(/server-only/);
	});

	it("KEY-S3 never hands the secrets to plugins through the public server config", () => {
		const cms = defineConfig({ ...site, database, auth, secret: "s", previousSecrets: ["old"] });
		expect(cms.server).not.toHaveProperty("secret");
		expect(cms.server).not.toHaveProperty("previousSecrets");
	});
});

describe("one secret, MONTI_SECRET", () => {
	it("KEY-S1 is read from the environment, and an explicit `secret` wins", () => {
		vi.stubEnv("MONTI_SECRET", "from-env");
		const stored = defineConfig({ ...site, database, auth })
			.plugin("ai")
			.secrets.encrypt("sk-1");
		expect(createSecretsVault({ secret: "from-env" }).forPlugin("ai").decrypt(stored)).toBe("sk-1");
		const explicit = defineConfig({ ...site, database, auth, secret: "explicit" })
			.plugin("ai")
			.secrets.encrypt("sk-2");
		expect(createSecretsVault({ secret: "explicit" }).forPlugin("ai").decrypt(explicit)).toBe("sk-2");
		expect(createSecretsVault({ secret: "from-env" }).forPlugin("ai").decrypt(explicit)).toBeNull();
	});

	it("does not read the old names", () => {
		vi.stubEnv("CMS_SECRET", "old-cms-secret");
		vi.stubEnv("AUTH_SECRET", "old-auth-secret");
		const cms = defineConfig({ ...site, database, auth });
		expect(cms.plugin("ai").secrets.available).toBe(false);
		expect(cms.plugin("auth").secrets.available).toBe(false);
	});

	it("AUTH-L6 derives the session key and every plugin's key from it, all different from each other", () => {
		const cms = defineConfig({ ...site, database, auth, secret: "master" });
		const session = cms.plugin("auth").secrets.deriveKey("session");
		expect(session).toHaveLength(32);
		expect(session.equals(cms.plugin("ai").secrets.deriveKey("session"))).toBe(false);
		expect(session.equals(cms.plugin("auth").secrets.deriveKey("other"))).toBe(false);
		expect(session.equals(Buffer.from("master"))).toBe(false);
		expect(
			session.equals(
				defineConfig({ ...site, database, auth, secret: "master" })
					.plugin("auth")
					.secrets.deriveKey("session"),
			),
		).toBe(true);
	});

	describe("a value stored under the old CMS_SECRET", () => {
		const OLD = "the-old-cms-secret";
		const stored = createSecretsVault({ secret: OLD }).forPlugin("ai").encrypt("sk-live-1234");

		it("decrypts when MONTI_SECRET is set to the old value", () => {
			vi.stubEnv("MONTI_SECRET", OLD);
			expect(
				defineConfig({ ...site, database, auth })
					.plugin("ai")
					.secrets.decrypt(stored),
			).toBe("sk-live-1234");
		});

		it("KEY-S2 decrypts when the old value is listed as a previous secret, and is current again after the next save", () => {
			vi.stubEnv("MONTI_SECRET", "the-new-monti-secret");
			const secrets = defineConfig({ ...site, database, auth, previousSecrets: [OLD] }).plugin("ai").secrets;
			expect(secrets.decrypt(stored)).toBe("sk-live-1234");
			expect(secrets.isCurrent(stored)).toBe(false);
			const renewed = secrets.encrypt(secrets.decrypt(stored) ?? "");
			expect(secrets.isCurrent(renewed)).toBe(true);
			expect(
				defineConfig({ ...site, database, auth })
					.plugin("ai")
					.secrets.decrypt(renewed),
			).toBe("sk-live-1234");
		});

		it("KEY-S2 accepts an unset environment variable in the list (`previousSecrets: [process.env.CMS_SECRET]`)", () => {
			vi.stubEnv("MONTI_SECRET", "the-new-monti-secret");
			expect(
				() => defineConfig({ ...site, database, auth, previousSecrets: [undefined] }).plugin("ai").secrets,
			).not.toThrow();
		});

		it("does not decrypt when the old secret is neither the new one nor listed", () => {
			vi.stubEnv("MONTI_SECRET", "the-new-monti-secret");
			// Not even when it is still in the environment under its old name: nothing is guessed from other names.
			vi.stubEnv("CMS_SECRET", OLD);
			expect(
				defineConfig({ ...site, database, auth })
					.plugin("ai")
					.secrets.decrypt(stored),
			).toBeNull();
		});
	});
});

describe("trust host", () => {
	const trusted = (options: { trustHost?: boolean } = {}) =>
		hostOf(defineConfig({ ...site, database, auth, ...options })).isHostTrusted();

	it("AUTH-L8 is detected on a known proxy platform in production", () => {
		vi.stubEnv("NODE_ENV", "production");
		expect(trusted()).toBe(false);
		vi.stubEnv("VERCEL", "1");
		expect(trusted()).toBe(true);
	});

	it("AUTH-L8 lets an explicit option win either way", () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("NETLIFY", "true");
		expect(trusted({ trustHost: false })).toBe(false);
		vi.stubEnv("NETLIFY", "");
		expect(trusted({ trustHost: true })).toBe(true);
	});
});

describe("site URL by convention, SITE_URL", () => {
	const urlOf = (extra: object = {}) => defineConfig({ ...site, database, auth, ...extra }).site.config.site?.url;

	it("CONF-A2 is read from SITE_URL when nothing else says it", () => {
		expect(urlOf()).toBeUndefined();
		vi.stubEnv("SITE_URL", "https://env.example.com");
		expect(urlOf()).toBe("https://env.example.com");
	});

	it("CONF-A2 is overridden by an explicit site.url, and by the schema file's", () => {
		vi.stubEnv("SITE_URL", "https://env.example.com");
		expect(urlOf({ site: { url: "https://code.example.com", name: "n" } })).toBe("https://code.example.com");
		const fromFile = defineConfig({
			schema: { ...site, site: { url: "https://file.example.com" } } as never,
			database,
			auth,
		});
		expect(fromFile.site.config.site?.url).toBe("https://file.example.com");
	});

	it("CONF-A2 keeps the other site settings when it fills the URL in", () => {
		vi.stubEnv("SITE_URL", "https://env.example.com");
		expect(defineConfig({ ...site, database, auth, site: { name: "Blog" } }).site.config.site).toEqual({
			name: "Blog",
			url: "https://env.example.com",
		});
	});
});

describe("keys the config does not have", () => {
	const issuesOf = (extra: object) => {
		try {
			defineConfig({ ...site, database, auth, ...extra });
		} catch (error) {
			return (error as ConfigError).issues;
		}
		return [];
	};

	it("CONF-S1 names the closest key, among the site options and the server options alike", () => {
		expect(issuesOf({ plugin: [] })).toEqual([
			expect.objectContaining({ path: "plugin", code: "unknown-key", message: expect.stringContaining('"plugins"') }),
		]);
		expect(issuesOf({ trusthost: true })).toEqual([
			expect.objectContaining({ path: "trusthost", message: expect.stringContaining('"trustHost"') }),
		]);
		expect(issuesOf({})).toEqual([]);
	});
});

describe("the host framework attaches itself to the instance", () => {
	const seen: { host?: import("../define").RequestHost } = {};
	const capturing: AuthAdapter = {
		name: "capture",
		create: (context) => {
			seen.host = context.host;
			return fakeCms().auth();
		},
	};

	it("AUTH-C2 gives the login the attached host's headers, also when the login was created first", async () => {
		const cms = defineConfig({ ...site, database, auth: capturing });
		cms.auth();
		const host = seen.host;
		expect(await host?.requestHeaders?.()).toBeNull();
		hostOf(cms).attachHost({
			requestHeaders: async () => new Headers({ host: "localhost:3000" }),
			rethrow: () => undefined,
		});
		expect((await host?.requestHeaders?.())?.get("host")).toBe("localhost:3000");
	});

	it("AUTH-C2 lets the framework's signals through", () => {
		const cms = defineConfig({ ...site, database, auth: capturing });
		cms.auth();
		hostOf(cms).attachHost({
			rethrow: (error) => {
				throw error;
			},
		});
		expect(() => seen.host?.rethrow?.(new Error("redirect"))).toThrow("redirect");
	});
});
