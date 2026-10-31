import { afterEach, describe, expect, it, vi } from "vitest";
import { defineSite } from "../../config/define";
import type { SchemaTypes } from "../../schema-file/types";
import { createCms } from "../create-cms";
import { fakeAuth, fakeCms } from "../fake-cms";

const schemaOf = (extra: Record<string, unknown> = {}) =>
	({
		collections: {
			post: {
				label: "Post",
				kind: "document",
				path: "/posts/:slug",
				fields: {
					title: { kind: "text", label: "Title", required: true },
					slug: { kind: "slug", label: "Address", from: "title" },
					...extra,
				},
			},
		},
		locales: [{ code: "en", name: "English" }],
		defaultLocale: "en",
	}) as unknown as SchemaTypes;

afterEach(() => vi.unstubAllEnvs());

describe("cms.plugin(name)", () => {
	it("PLUG-S6 gives a plugin its own storage, secrets and the key store", () => {
		const cms = fakeCms({ server: { secret: "a-long-enough-test-secret" } });
		const context = cms.plugin("my-plugin");
		expect(context.name).toBe("my-plugin");
		expect(context.storage.plugin).toBe("my-plugin");
		expect(context.secrets.available).toBe(true);
		expect(context.apiKeys).toBe(cms.apiKeys);
	});

	it("PLUG-S6 makes a value once per key and plugin", () => {
		const cms = fakeCms();
		const make = vi.fn(() => ({}));
		const first = cms.plugin("a").once("store", make);
		expect(cms.plugin("a").once("store", make)).toBe(first);
		expect(cms.plugin("b").once("store", make)).not.toBe(first);
		expect(make).toHaveBeenCalledTimes(2);
	});

	it("PLUG-S6 starts again after a schema reload, so a value built from the site never keeps the old one", () => {
		vi.stubEnv("NODE_ENV", "development");
		const cms = createCms({
			config: defineSite({ schema: schemaOf() }),
			server: {
				database: {
					name: "fake",
					createStore: vi.fn(),
					migrate: vi.fn(),
					pluginStorage: vi.fn(),
					transaction: vi.fn(),
				},
				auth: fakeAuth(),
			},
		});
		const build = () => ({ site: cms.site });
		const before = cms.plugin("a").once("store", build);
		expect(before.site).toBe(cms.site);

		expect(cms.reloadSchema(schemaOf({ extra: { kind: "text", label: "Extra" } }))).toEqual({ reloaded: true });
		const after = cms.plugin("a").once("store", build);
		expect(after).not.toBe(before);
		expect(after.site).toBe(cms.site);
		expect(after.site).not.toBe(before.site);
	});
});
