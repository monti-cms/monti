import { type CmsConfig, createSite } from "@monti-cms/core/site";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../core/test/site";
import { loadAdminPlugins } from "../plugins";

/** A site of its own per call: the loaded plugins are remembered per site, so no result is shared between tests. */
const siteWith = (plugins: unknown[]) => createSite({ ...testConfig, plugins } as CmsConfig);

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

	it("lets a plugin page share a name with a core screen: pages live under tools/", async () => {
		const site = siteWith([{ name: "events-plus", admin: admin({ events: Page, templates: Page }) }]);
		expect((await loadAdminPlugins(site)).map((plugin) => plugin.name)).toEqual(["events-plus"]);
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
