import { type CmsConfig, definePlugin } from "@monti-cms/core";
import { createSite } from "@monti-cms/core/site";
import { describe, expect, it } from "vitest";
import { testConfig, testSite } from "../../../../../core/test/site";
import { isToolsNav, toolsHref, toolsTabs } from "../tools-tabs";

const withPlugins = (templates = true) =>
	createSite({
		...testConfig,
		admin: { ...testConfig.admin, templates },
		plugins: [
			definePlugin({ name: "stats", options: {}, nav: [{ path: "stats", label: "Post stats" }] }),
			definePlugin({ name: "more", options: {}, nav: [{ path: "/more/", label: () => "More" }] }),
		],
	} as CmsConfig);

describe("the tabs of the tools page", () => {
	it("starts with templates, data, the activity log and API keys, then the plugin pages in plugin order", () => {
		const ids = toolsTabs(withPlugins()).map((tab) => tab.id);
		expect(ids).toEqual(["templates", "data", "events", "api-keys", "tools:stats", "tools:more"]);
	});

	it("leaves templates out when the site turns them off", () => {
		expect(toolsTabs(withPlugins(false)).map((tab) => tab.id)).not.toContain("templates");
	});

	it("gives each tab its own address under the tools address", () => {
		const site = withPlugins();
		for (const tab of toolsTabs(site)) expect(tab.href).toBe(site.adminHref(`/tools/${tab.path}`));
		expect(toolsTabs(site).find((tab) => tab.id === "tools:more")?.path).toBe("more");
	});

	it("names a plugin tab by its nav label, calling a label function with the site", () => {
		const labels = toolsTabs(withPlugins()).map((tab) => tab.label);
		expect(labels).toEqual(expect.arrayContaining(["Post stats", "More"]));
	});

	it("never lets a plugin page take the address of a built-in tab", () => {
		const site = createSite({
			...testConfig,
			plugins: [definePlugin({ name: "clash", options: {}, nav: [{ path: "data", label: "Mine" }] })],
		} as CmsConfig);
		expect(toolsTabs(site).filter((tab) => tab.path === "data")).toHaveLength(1);
	});

	it("points the tools address at the first tab", () => {
		expect(toolsHref(testSite)).toBe(toolsTabs(testSite)[0]?.href);
		expect(toolsHref(withPlugins(false))).toBe(withPlugins(false).adminHref("/tools/data"));
	});

	it("knows which nav ids belong to the tools page", () => {
		for (const id of ["templates", "data", "events", "api-keys", "tools:stats"] as const)
			expect(isToolsNav(id)).toBe(true);
		for (const id of ["media", "settings", "trash", testSite.DEFAULT_COLLECTION] as const)
			expect(isToolsNav(id)).toBe(false);
	});
});
