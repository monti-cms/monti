import { describe, expect, it } from "vitest";
import { defineCollection, definePlugin, defineSite, fields } from "../..";
import {
	assertPluginRoutesFree,
	checkPluginNames,
	checkPluginPages,
	checkPluginRoutes,
	RESERVED_SCOPES,
} from "../collisions";

describe("checkPluginPages", () => {
	it("accepts distinct pages", () => {
		expect(
			checkPluginPages([
				{ plugin: "ai", path: "ai" },
				{ plugin: "seo", path: "/seo/" },
			]),
		).toEqual([]);
	});

	it("rejects a page without a path", () => {
		for (const path of ["", "/", "//"]) {
			expect(checkPluginPages([{ plugin: "evil", path }])).toEqual([expect.objectContaining({ code: "empty" })]);
		}
	});

	it("lets a plugin page share a name with a core screen: pages live under tools/", () => {
		for (const path of ["templates", "events", "settings", "trash", "media"]) {
			expect(checkPluginPages([{ plugin: "ok", path }])).toEqual([]);
		}
	});

	it("rejects a page another plugin already uses", () => {
		expect(
			checkPluginPages([
				{ plugin: "a", path: "tools" },
				{ plugin: "b", path: "/tools" },
			]),
		).toEqual([expect.objectContaining({ path: 'plugins.b.nav["/tools"]', code: "collision" })]);
	});

	it("lets one plugin name the same page twice", () => {
		expect(
			checkPluginPages([
				{ plugin: "a", path: "tools" },
				{ plugin: "a", path: "tools" },
			]),
		).toEqual([]);
	});
});

describe("assertPluginRoutesFree", () => {
	const core = ["v1/entries", "v1/entries/[id]", "v1/meta"];

	it("accepts distinct routes", () => {
		expect(() =>
			assertPluginRoutesFree(core, [
				{ plugin: "ai", pattern: "v1/ai/run" },
				{ plugin: "ai", pattern: "v1/ai/actions/[key]" },
			]),
		).not.toThrow();
	});

	it("rejects a route that equals a core route, even with another param name", () => {
		expect(checkPluginRoutes(core, [{ plugin: "x", pattern: "v1/meta" }])).toEqual([
			expect.objectContaining({ path: 'plugins.x.routes["v1/meta"]', code: "collision" }),
		]);
		expect(checkPluginRoutes(core, [{ plugin: "x", pattern: "v1/entries/[entry]" }])[0]?.message).toContain(
			'core route "v1/entries/[id]"',
		);
	});

	it("rejects the core auth prefix", () => {
		expect(checkPluginRoutes(core, [{ plugin: "x", pattern: "auth/callback" }])[0]?.message).toContain('"auth/*"');
	});

	it("rejects a route another plugin already has", () => {
		const issues = checkPluginRoutes(core, [
			{ plugin: "a", pattern: "v1/tools/[id]" },
			{ plugin: "b", pattern: "v1/tools/[name]" },
		]);
		expect(issues).toEqual([
			expect.objectContaining({ path: 'plugins.b.routes["v1/tools/[name]"]', code: "collision" }),
		]);
		expect(issues[0]?.message).toContain('plugin "a"');
	});
});

describe("checkPluginNames", () => {
	it("rejects a plugin name equal to a core feature", () => {
		expect(checkPluginNames(["media"])).toEqual([
			expect.objectContaining({ path: "plugins[0].name", code: "collision" }),
		]);
		expect(checkPluginNames(["ai", "seo"])).toEqual([]);
	});
});

describe("checkPluginNames: core storage scopes", () => {
	it.each(RESERVED_SCOPES)("rejects a plugin named %s, which would read the core's secrets and data", (name) => {
		expect(checkPluginNames([name])[0]?.message).toContain("core storage scope");
	});

	it("reserves the scopes the core itself uses", () => {
		expect([...RESERVED_SCOPES].sort()).toEqual(["auth", "core-keys"]);
	});
});

describe("defineSite: plugin collisions", () => {
	const collection = defineCollection({
		label: "Topic",
		kind: "item",
		fields: { title: fields.text({ label: "Title" }), slug: fields.slug({ label: "Slug", from: "title" }) },
	});
	const base = { collections: { topic: collection }, locales: [{ code: "en", name: "English" }], defaultLocale: "en" };
	const plugin = (name: string, path?: string) =>
		definePlugin({ name, options: {}, nav: path === undefined ? undefined : [{ path, label: name }] });

	it("accepts plugins with distinct names and pages", () => {
		expect(() => defineSite({ ...base, plugins: [plugin("a", "a"), plugin("b", "b")] })).not.toThrow();
	});

	it("rejects a nav path two plugins share", () => {
		expect(() => defineSite({ ...base, plugins: [plugin("a", "tools"), plugin("b", "tools")] })).toThrow(
			/of plugin "b" collides with plugin "a"/,
		);
	});

	it("rejects a plugin named like a core feature", () => {
		expect(() => defineSite({ ...base, plugins: [plugin("search")] })).toThrow(/collides with the core feature/);
	});
});
