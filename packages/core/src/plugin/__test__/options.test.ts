import { describe, expect, expectTypeOf, it } from "vitest";
import { defineCollection, definePlugin, defineSite, fields, type PluginId } from "../..";
import { createSite } from "../../site";

const page = defineCollection({
	label: "Page",
	kind: "document",
	fields: {
		title: fields.text({ label: "Title", required: true }),
		slug: fields.slug({ label: "Slug", from: "title", required: true }),
	},
});

const site = createSite(
	defineSite({
		collections: { page },
		locales: [{ code: "en", name: "English" }],
		defaultLocale: "en",
		plugins: [
			definePlugin({ name: "color", options: { palette: ["red"] } }),
			definePlugin({ name: "seo", options: {} }),
		],
	}),
);

const COLOR: PluginId<"color", { readonly palette: readonly string[] }> = { name: "color" };
const AI: PluginId<"ai", { readonly model: string }> = { name: "ai" };

describe("site.pluginOptions", () => {
	it("PLUG-S4 returns the options of the plugin with that id's name, typed by the id", () => {
		const options = site.pluginOptions(COLOR);
		expect(options).toEqual({ palette: ["red"] });
		expectTypeOf(options).toEqualTypeOf<{ readonly palette: readonly string[] } | undefined>();
	});

	it("is undefined for a plugin the site config does not list", () => {
		expect(site.pluginOptions(AI)).toBeUndefined();
	});

	it("is undefined for every name when the config lists no plugins", () => {
		const bare = createSite(
			defineSite({ collections: { page }, locales: [{ code: "en", name: "English" }], defaultLocale: "en" }),
		);
		expect(bare.pluginOptions(COLOR)).toBeUndefined();
	});

	it("PLUG-S4 keeps the options of two sites apart", () => {
		const other = createSite(
			defineSite({
				collections: { page },
				locales: [{ code: "en", name: "English" }],
				defaultLocale: "en",
				plugins: [definePlugin({ name: "color", options: { palette: ["blue"] } })],
			}),
		);
		expect(other.pluginOptions(COLOR)).toEqual({ palette: ["blue"] });
		expect(site.pluginOptions(COLOR)).toEqual({ palette: ["red"] });
	});
});

describe("definePlugin", () => {
	it("needs only a name for a plugin that adds hooks: options are an empty object, the hooks stay in its server module", async () => {
		const on = { entry: { beforeSave: [() => undefined] } };
		const plugin = definePlugin({ name: "hook-only", server: async () => ({ default: { on } }) });
		expect(plugin.options).toEqual({});
		expect((await plugin.server?.())?.default).toEqual({ on });
	});

	it("keeps the options it is given", () => {
		expect(definePlugin({ name: "with-options", options: { a: 1 } }).options).toEqual({ a: 1 });
	});
});
