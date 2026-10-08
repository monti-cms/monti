import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineSite } from "../../config/define";
import { defineConfig } from "../../server/config";
import type { Decision } from "../../server/decision";
import type { AuthAdapter, DatabaseAdapter } from "../../server/define";
import { createCms } from "../create-cms";
import { fakeAuth, fakeCms } from "../fake-cms";

const schema = {
	schemaVersion: 1,
	collections: {
		page: {
			label: "Page",
			kind: "document",
			path: "/:slug",
			fields: {
				title: { kind: "text", label: "Title", required: true },
				slug: { kind: "slug", label: "Slug", from: "title" },
			},
		},
	},
	locales: [{ code: "en", name: "English" }],
	defaultLocale: "en",
};

let dir: string;
beforeEach(() => {
	dir = mkdtempSync(path.join(tmpdir(), "monti-decisions-"));
	vi.spyOn(process, "cwd").mockReturnValue(dir);
	for (const name of ["SITE_URL", "AUTH_TRUST_HOST", "VERCEL", "NETLIFY", "CF_PAGES"]) vi.stubEnv(name, "");
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
	rmSync(dir, { recursive: true, force: true });
});

const writeSchema = (siteUrl?: string) =>
	writeFileSync(
		path.join(dir, "monti.schema.json"),
		JSON.stringify(siteUrl ? { ...schema, site: { url: siteUrl } } : schema),
	);
const topics = (decisions: readonly { topic: string }[]) => decisions.map((item) => item.topic);
const find = (decisions: readonly { topic: string; value: string; source: string }[], topic: string) =>
	decisions.find((item) => item.topic === topic);

describe("Cms.decisions", () => {
	it("lists what the database and login adapters report, then the core decisions", () => {
		const database: DatabaseAdapter = {
			name: "fake",
			createStore: vi.fn(),
			migrate: vi.fn(),
			pluginStorage: vi.fn(),
			decisions: () => [{ topic: "Database", value: "x", source: "from env DATABASE_URL" }],
		};
		const auth: AuthAdapter = {
			...fakeAuth(),
			decisions: () => [{ topic: "Login", value: "GitHub", source: "set in monti.config.ts (github)" }],
		};
		const cms = fakeCms({ server: { database, auth } });
		expect(topics(cms.decisions({ NODE_ENV: "production" }))).toEqual([
			"Database",
			"Login",
			"Trust host",
			"SITE_URL",
			"Schema file",
			"Schema hot reload",
		]);
	});

	it("reports no schema file for a config written in code", () => {
		writeSchema();
		const decisions = fakeCms().decisions({ NODE_ENV: "development" });
		expect(find(decisions, "Schema file")?.source).toBe("no schema file found");
		expect(find(decisions, "Schema hot reload")?.value).toBe("off");
	});

	it("auto-detects the schema file in the working directory", () => {
		writeSchema();
		const cms = createCms({ config: defineSite({ schema }), server: fakeCms().server });
		const file = find(cms.decisions({ NODE_ENV: "production" }), "Schema file");
		expect(file?.value).toBe("monti.schema.json");
		expect(file?.source).toContain("auto-detected");
	});

	it("reports a schema file given in the options as set in the config", () => {
		writeSchema();
		const cms = createCms({
			config: defineSite({ schema }),
			server: fakeCms().server,
			schemaFile: "monti.schema.json",
		});
		expect(find(cms.decisions({ NODE_ENV: "production" }), "Schema file")?.source).toBe("set in monti.config.ts");
	});

	it("turns hot reload on only in development with a schema file", () => {
		writeSchema();
		const cms = createCms({ config: defineSite({ schema }), server: fakeCms().server });
		expect(find(cms.decisions({ NODE_ENV: "development" }), "Schema hot reload")?.value).toBe("on");
		const production = find(cms.decisions({ NODE_ENV: "production" }), "Schema hot reload");
		expect(production?.value).toBe("off");
		expect(production?.source).toContain('NODE_ENV is "production"');

		rmSync(path.join(dir, "monti.schema.json"));
		const bare = createCms({ config: defineSite({ schema }), server: fakeCms().server });
		expect(find(bare.decisions({ NODE_ENV: "development" }), "Schema hot reload")?.value).toBe("off");
	});

	it("explains host trust from the environment passed in", () => {
		const cms = fakeCms();
		expect(find(cms.decisions({ NODE_ENV: "production" }), "Trust host")).toMatchObject({ value: "off" });
		expect(find(cms.decisions({ NODE_ENV: "production", AUTH_TRUST_HOST: "1" }), "Trust host")?.source).toBe(
			"from env AUTH_TRUST_HOST",
		);
		expect(find(fakeCms({ server: { trustHost: true } }).decisions({}), "Trust host")?.source).toContain("trustHost");
	});

	it("a detached instance (forSchema) reports the same decisions", () => {
		writeSchema();
		const cms = createCms({ config: defineSite({ schema }), server: fakeCms().server });
		expect(cms.forSchema(schema).decisions({ NODE_ENV: "production" })).toEqual(
			cms.decisions({ NODE_ENV: "production" }),
		);
	});
});

describe("SITE_URL source through defineConfig", () => {
	const database: DatabaseAdapter = { name: "fake", createStore: vi.fn(), migrate: vi.fn(), pluginStorage: vi.fn() };
	const auth: AuthAdapter = fakeAuth();
	const site = {
		collections: fakeCms().site.config.collections,
		locales: [{ code: "en", name: "English" }],
		defaultLocale: "en",
	};
	const siteUrl = (cms: { decisions(env: Record<string, string>): readonly Decision[] }) =>
		find(cms.decisions({ NODE_ENV: "production" }), "SITE_URL");

	it("comes from site.url in the config first", () => {
		vi.stubEnv("SITE_URL", "https://env.test");
		const cms = defineConfig({ ...site, site: { url: "https://config.test" }, database, auth } as never);
		expect(siteUrl(cms)).toEqual({
			topic: "SITE_URL",
			value: "https://config.test",
			source: "set in monti.config.ts (site.url)",
		});
	});

	it("comes from the schema file next", () => {
		vi.stubEnv("SITE_URL", "https://env.test");
		const cms = defineConfig({ schema: { ...schema, site: { url: "https://file.test" } }, database, auth } as never);
		expect(siteUrl(cms)).toEqual({
			topic: "SITE_URL",
			value: "https://file.test",
			source: "set in the schema file (site.url)",
		});
	});

	it("comes from env SITE_URL when nothing else says", () => {
		vi.stubEnv("SITE_URL", "https://env.test");
		const cms = defineConfig({ ...site, database, auth } as never);
		expect(siteUrl(cms)).toEqual({ topic: "SITE_URL", value: "https://env.test", source: "from env SITE_URL" });
	});

	it("is reported as not set when nothing says", () => {
		const cms = defineConfig({ ...site, database, auth } as never);
		expect(siteUrl(cms)?.value).toBe("not set");
		expect(siteUrl(cms)?.source).toContain("SITE_URL");
	});
});
