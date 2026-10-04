import { readFileSync } from "node:fs";
import path from "node:path";
import { CORE_ADMIN_PAGES } from "@monti-cms/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ plugins: [] as unknown[] }));

vi.mock("@monti-cms/core/client", () => ({
	cmsConfig: {
		get plugins() {
			return state.plugins;
		},
	},
}));

// `PLUGINS` is fixed when the module is read, so each test re-imports the module.
const load = async () => {
	vi.resetModules();
	return (await import("../plugins")).loadAdminPlugins;
};

const Page = () => null;
const admin = (pages: Record<string, unknown>) => async () => ({ default: { pages } });

beforeEach(() => {
	vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("loadAdminPlugins", () => {
	it("does not cache a failed import, so a retry can succeed", async () => {
		let attempts = 0;
		state.plugins = [
			{
				name: "flaky",
				admin: async () => {
					attempts += 1;
					if (attempts === 1) throw new Error("import failed");
					return { default: { pages: { tools: Page } } };
				},
			},
		];
		const loadAdminPlugins = await load();
		await expect(loadAdminPlugins()).rejects.toThrow("import failed");
		expect((await loadAdminPlugins())[0]).toMatchObject({ name: "flaky", pages: { tools: Page } });
		// After a success it is not read again.
		await loadAdminPlugins();
		expect(attempts).toBe(2);
	});

	it("throws when a plugin page equals a core admin page", async () => {
		state.plugins = [{ name: "evil", admin: admin({ media: Page }) }];
		const loadAdminPlugins = await load();
		await expect(loadAdminPlugins()).rejects.toThrow(
			/admin page "\/media" of plugin "evil" collides with the core admin page "\/media"/,
		);
	});

	it("throws when two plugins use the same page", async () => {
		state.plugins = [
			{ name: "a", admin: admin({ tools: Page }) },
			{ name: "b", admin: admin({ tools: Page }) },
		];
		const loadAdminPlugins = await load();
		await expect(loadAdminPlugins()).rejects.toThrow(/of plugin "b" collides with plugin "a"/);
	});

	it("loads plugins with distinct pages", async () => {
		state.plugins = [
			{ name: "a", admin: admin({ one: Page }) },
			{ name: "b", admin: admin({ two: Page }) },
			{ name: "plain" },
		];
		const loadAdminPlugins = await load();
		expect((await loadAdminPlugins()).map((plugin) => plugin.name)).toEqual(["a", "b", "plain"]);
	});
});

describe("core admin pages", () => {
	it("the admin page router handles every core page the collision check reserves", () => {
		const source = readFileSync(path.resolve(__dirname, "../next/page.tsx"), "utf8");
		for (const core of CORE_ADMIN_PAGES.filter(Boolean)) {
			expect(source, core).toMatch(new RegExp(`case "${core}":|first === "${core}"`));
		}
	});
});
