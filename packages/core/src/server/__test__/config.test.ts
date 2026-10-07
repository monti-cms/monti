import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../test/site";
import { fakeCms } from "../../cms";
import { createSecretsVault } from "../../secrets";
import { defineConfig } from "../config";
import type { AuthAdapter, DatabaseAdapter, MediaAdapter } from "../define";

const database = {
	name: "fake",
	createStore: vi.fn(),
	migrate: vi.fn(),
	pluginStorage: vi.fn(),
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
	]) {
		vi.stubEnv(name, "");
	}
});
afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("defineConfig: one config, one instance", () => {
	it("makes the CMS instance from the site options and the server options together", () => {
		const cms = defineConfig({ ...site, database, auth });
		expect(Object.keys(cms.site.config.collections)).toEqual(Object.keys(testConfig.collections));
		expect(cms.server.database).toBe(database);
		expect(cms.isMediaConfigured).toBe(false);
	});

	it("takes any storage adapter as `storage`", () => {
		const storage = { name: "any-package", createStore: vi.fn() } as unknown as MediaAdapter;
		const cms = defineConfig({ ...site, database, auth, storage });
		expect(cms.isMediaConfigured).toBe(true);
		expect(cms.server.media).toBe(storage);
	});

	it("names what is missing", () => {
		expect(() => defineConfig({ ...site, auth } as never)).toThrow(/database.*postgres\(\)/);
		expect(() => defineConfig({ ...site, database } as never)).toThrow(/auth/);
	});

	it("refuses to load in a browser bundle", () => {
		vi.stubGlobal("window", {});
		expect(() => defineConfig({ ...site, database, auth })).toThrow(/server-only/);
	});

	it("never hands the secrets to plugins through the public server config", () => {
		const cms = defineConfig({ ...site, database, auth, secret: "s", previousSecrets: ["old"] });
		expect(cms.server).not.toHaveProperty("secret");
		expect(cms.server).not.toHaveProperty("previousSecrets");
	});
});

describe("one secret, MONTI_SECRET", () => {
	it("is read from the environment, and an explicit `secret` wins", () => {
		vi.stubEnv("MONTI_SECRET", "from-env");
		const stored = defineConfig({ ...site, database, auth })
			.secrets("ai")
			.encrypt("sk-1");
		expect(createSecretsVault({ secret: "from-env" }).forPlugin("ai").decrypt(stored)).toBe("sk-1");
		const explicit = defineConfig({ ...site, database, auth, secret: "explicit" })
			.secrets("ai")
			.encrypt("sk-2");
		expect(createSecretsVault({ secret: "explicit" }).forPlugin("ai").decrypt(explicit)).toBe("sk-2");
		expect(createSecretsVault({ secret: "from-env" }).forPlugin("ai").decrypt(explicit)).toBeNull();
	});

	it("does not read the old names", () => {
		vi.stubEnv("CMS_SECRET", "old-cms-secret");
		vi.stubEnv("AUTH_SECRET", "old-auth-secret");
		const cms = defineConfig({ ...site, database, auth });
		expect(cms.secrets("ai").available).toBe(false);
		expect(cms.secrets("auth").available).toBe(false);
	});

	it("derives the session key and every plugin's key from it, all different from each other", () => {
		const cms = defineConfig({ ...site, database, auth, secret: "master" });
		const session = cms.secrets("auth").deriveKey("session");
		expect(session).toHaveLength(32);
		expect(session.equals(cms.secrets("ai").deriveKey("session"))).toBe(false);
		expect(session.equals(cms.secrets("auth").deriveKey("other"))).toBe(false);
		expect(session.equals(Buffer.from("master"))).toBe(false);
		expect(
			session.equals(
				defineConfig({ ...site, database, auth, secret: "master" })
					.secrets("auth")
					.deriveKey("session"),
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
					.secrets("ai")
					.decrypt(stored),
			).toBe("sk-live-1234");
		});

		it("decrypts when the old value is listed as a previous secret, and is current again after the next save", () => {
			vi.stubEnv("MONTI_SECRET", "the-new-monti-secret");
			const secrets = defineConfig({ ...site, database, auth, previousSecrets: [OLD] }).secrets("ai");
			expect(secrets.decrypt(stored)).toBe("sk-live-1234");
			expect(secrets.isCurrent(stored)).toBe(false);
			const renewed = secrets.encrypt(secrets.decrypt(stored) ?? "");
			expect(secrets.isCurrent(renewed)).toBe(true);
			expect(
				defineConfig({ ...site, database, auth })
					.secrets("ai")
					.decrypt(renewed),
			).toBe("sk-live-1234");
		});

		it("accepts an unset environment variable in the list (`previousSecrets: [process.env.CMS_SECRET]`)", () => {
			vi.stubEnv("MONTI_SECRET", "the-new-monti-secret");
			expect(() => defineConfig({ ...site, database, auth, previousSecrets: [undefined] }).secrets("ai")).not.toThrow();
		});

		it("does not decrypt when the old secret is neither the new one nor listed", () => {
			vi.stubEnv("MONTI_SECRET", "the-new-monti-secret");
			// Not even when it is still in the environment under its old name: nothing is guessed from other names.
			vi.stubEnv("CMS_SECRET", OLD);
			expect(
				defineConfig({ ...site, database, auth })
					.secrets("ai")
					.decrypt(stored),
			).toBeNull();
		});
	});
});

describe("trust host", () => {
	const trusted = (options: { trustHost?: boolean } = {}) =>
		defineConfig({ ...site, database, auth, ...options }).isHostTrusted();

	it("is detected on a known proxy platform in production", () => {
		vi.stubEnv("NODE_ENV", "production");
		expect(trusted()).toBe(false);
		vi.stubEnv("VERCEL", "1");
		expect(trusted()).toBe(true);
	});

	it("lets an explicit option win either way", () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("NETLIFY", "true");
		expect(trusted({ trustHost: false })).toBe(false);
		vi.stubEnv("NETLIFY", "");
		expect(trusted({ trustHost: true })).toBe(true);
	});
});
