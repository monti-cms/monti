import { readFileSync } from "node:fs";
import path from "node:path";
import { CORE_ADMIN_PAGES } from "@monti-cms/core";
import { type AnyCmsConfig, createSite } from "@monti-cms/core/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../core/test/site";
import { loadAdminPlugins } from "../plugins";

/** A site of its own per call: the loaded plugins are remembered per site, so no result is shared between tests. */
const siteWith = (plugins: unknown[]) => createSite({ ...testConfig, plugins } as AnyCmsConfig);

const Page = () => null;
const admin = (pages: Record<string, unknown>) => async () => ({ default: { pages } });

beforeEach(() => {
	vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("loadAdminPlugins", () => {
	it("does not cache a failed import, so a retry can succeed", async () => {
		let attempts = 0;
		const site = siteWith([
			{
				name: "flaky",
				admin: async () => {
					attempts += 1;
					if (attempts === 1) throw new Error("import failed");
					return { default: { pages: { tools: Page } } };
				},
			},
		]);
		await expect(loadAdminPlugins(site)).rejects.toThrow("import failed");
		expect((await loadAdminPlugins(site))[0]).toMatchObject({ name: "flaky", pages: { tools: Page } });
		// After a success it is not read again.
		await loadAdminPlugins(site);
		expect(attempts).toBe(2);
	});

	it("throws when a plugin page equals a core admin page", async () => {
		const site = siteWith([{ name: "evil", admin: admin({ media: Page }) }]);
		await expect(loadAdminPlugins(site)).rejects.toThrow(
			/admin page "\/media" of plugin "evil" collides with the core admin page "\/media"/,
		);
	});

	it("throws when two plugins use the same page", async () => {
		const site = siteWith([
			{ name: "a", admin: admin({ tools: Page }) },
			{ name: "b", admin: admin({ tools: Page }) },
		]);
		await expect(loadAdminPlugins(site)).rejects.toThrow(/of plugin "b" collides with plugin "a"/);
	});

	it("loads plugins with distinct pages", async () => {
		const site = siteWith([
			{ name: "a", admin: admin({ one: Page }) },
			{ name: "b", admin: admin({ two: Page }) },
			{ name: "plain" },
		]);
		expect((await loadAdminPlugins(site)).map((plugin) => plugin.name)).toEqual(["a", "b", "plain"]);
	});

	it("keeps the loaded plugins of one site apart from another site", async () => {
		const first = siteWith([{ name: "a", admin: admin({ one: Page }) }]);
		const second = siteWith([{ name: "b", admin: admin({ two: Page }) }]);
		expect((await loadAdminPlugins(first)).map((plugin) => plugin.name)).toEqual(["a"]);
		expect((await loadAdminPlugins(second)).map((plugin) => plugin.name)).toEqual(["b"]);
	});
});

describe("core admin pages", () => {
	it("the admin page router handles every core page the collision check reserves", () => {
		const source = readFileSync(path.resolve(__dirname, "../host/page.tsx"), "utf8");
		for (const core of CORE_ADMIN_PAGES.filter(Boolean)) {
			expect(source, core).toMatch(new RegExp(`case "${core}":|first === "${core}"`));
		}
	});
});
