import { describe, expect, it } from "vitest";
import { defineCollection, definePlugin, defineSite, fields } from "../..";
import { assertPluginNamesFree, assertPluginPagesFree, assertPluginRoutesFree, RESERVED_SCOPES } from "../collisions";

describe("assertPluginPagesFree", () => {
	it("accepts distinct pages", () => {
		expect(() =>
			assertPluginPagesFree([
				{ plugin: "ai", path: "ai" },
				{ plugin: "seo", path: "/seo/" },
			]),
		).not.toThrow();
	});

	it("rejects a page without a path", () => {
		for (const path of ["", "/", "//"]) {
			expect(() => assertPluginPagesFree([{ plugin: "evil", path }])).toThrow(
				/tools page "\/" of plugin "evil" has no path/,
			);
		}
	});

	it("lets a plugin page share a name with a core screen: pages live under tools/", () => {
		for (const path of ["templates", "events", "settings", "trash", "media"]) {
			expect(() => assertPluginPagesFree([{ plugin: "ok", path }])).not.toThrow();
		}
	});

	it("rejects a page another plugin already uses", () => {
		expect(() =>
			assertPluginPagesFree([
				{ plugin: "a", path: "tools" },
				{ plugin: "b", path: "/tools" },
			]),
		).toThrow(/tools page "\/tools" of plugin "b" collides with plugin "a"/);
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

describe("assertPluginNamesFree: core storage scopes", () => {
	it.each(RESERVED_SCOPES)("rejects a plugin named %s, which would read the core's secrets and data", (name) => {
		expect(() => assertPluginNamesFree([name])).toThrow(/collides with the core storage scope/);
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
