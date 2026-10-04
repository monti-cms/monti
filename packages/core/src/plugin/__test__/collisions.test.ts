import { describe, expect, it } from "vitest";
import { defineCollection, defineConfig, definePlugin, fields } from "../..";
import { assertPluginNamesFree, assertPluginPagesFree, assertPluginRoutesFree, CORE_ADMIN_PAGES } from "../collisions";

describe("assertPluginPagesFree", () => {
	it("accepts distinct pages", () => {
		expect(() =>
			assertPluginPagesFree([
				{ plugin: "ai", path: "ai" },
				{ plugin: "seo", path: "/seo/" },
			]),
		).not.toThrow();
	});

	it("rejects a page that equals a core admin page, naming both sides", () => {
		for (const core of CORE_ADMIN_PAGES.filter(Boolean)) {
			expect(() => assertPluginPagesFree([{ plugin: "evil", path: core }])).toThrow(
				new RegExp(`"/${core}" of plugin "evil" collides with the core admin page "/${core}"`),
			);
		}
		expect(() => assertPluginPagesFree([{ plugin: "evil", path: "/" }])).toThrow(/collides with the core admin page/);
	});

	it("rejects a page another plugin already uses", () => {
		expect(() =>
			assertPluginPagesFree([
				{ plugin: "a", path: "tools" },
				{ plugin: "b", path: "/tools" },
			]),
		).toThrow(/admin page "\/tools" of plugin "b" collides with plugin "a"/);
	});

	it("lets one plugin name the same page twice (nav and pages)", () => {
		expect(() =>
			assertPluginPagesFree([
				{ plugin: "a", path: "tools" },
				{ plugin: "a", path: "tools" },
			]),
		).not.toThrow();
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
		expect(() => assertPluginRoutesFree(core, [{ plugin: "x", pattern: "v1/meta" }])).toThrow(
			/route "v1\/meta" of plugin "x" collides with the core route "v1\/meta"/,
		);
		expect(() => assertPluginRoutesFree(core, [{ plugin: "x", pattern: "v1/entries/[entry]" }])).toThrow(
			/collides with the core route "v1\/entries\/\[id\]"/,
		);
	});

	it("rejects the core auth prefix", () => {
		expect(() => assertPluginRoutesFree(core, [{ plugin: "x", pattern: "auth/callback" }])).toThrow(/"auth\/\*"/);
	});

	it("rejects a route another plugin already has", () => {
		expect(() =>
			assertPluginRoutesFree(core, [
				{ plugin: "a", pattern: "v1/tools/[id]" },
				{ plugin: "b", pattern: "v1/tools/[name]" },
			]),
		).toThrow(/"v1\/tools\/\[name\]" of plugin "b" collides with the route "v1\/tools\/\[id\]" of plugin "a"/);
	});
});

describe("assertPluginNamesFree", () => {
	it("rejects a plugin name equal to a core feature", () => {
		expect(() => assertPluginNamesFree(["media"])).toThrow(/plugin name "media" collides with the core feature/);
		expect(() => assertPluginNamesFree(["ai", "seo"])).not.toThrow();
	});
});

describe("defineConfig: plugin collisions", () => {
	const collection = defineCollection({
		label: "Topic",
		kind: "item",
		fields: { title: fields.text({ label: "Title" }), slug: fields.slug({ label: "Slug", from: "title" }) },
		list: { columns: [] },
	});
	const base = { collections: { topic: collection }, locales: [{ code: "en", name: "English" }], defaultLocale: "en" };
	const plugin = (name: string, path?: string) =>
		definePlugin({ name, options: {}, nav: path === undefined ? undefined : [{ path, label: name }] });

	it("accepts plugins with distinct names and pages", () => {
		expect(() => defineConfig({ ...base, plugins: [plugin("a", "a"), plugin("b", "b")] })).not.toThrow();
	});

	it("rejects a nav path equal to a core admin page", () => {
		expect(() => defineConfig({ ...base, plugins: [plugin("a", "media")] })).toThrow(
			/admin page "\/media" of plugin "a" collides with the core admin page/,
		);
	});

	it("rejects a nav path two plugins share", () => {
		expect(() => defineConfig({ ...base, plugins: [plugin("a", "tools"), plugin("b", "tools")] })).toThrow(
			/of plugin "b" collides with plugin "a"/,
		);
	});

	it("rejects a plugin named like a core feature", () => {
		expect(() => defineConfig({ ...base, plugins: [plugin("search")] })).toThrow(/collides with the core feature/);
	});
});
