import { describe, expect, it } from "vitest";
import { defineCollection, definePlugin, defineSite, fields } from "../..";
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

describe("site.getPluginOptions", () => {
	it("returns the options of the plugin with that name", () => {
		expect(site.getPluginOptions<{ palette: string[] }>("color")).toEqual({ palette: ["red"] });
	});

	it("is undefined for a plugin the site config does not list", () => {
		expect(site.getPluginOptions("ai")).toBeUndefined();
	});

	it("is undefined for every name when the config lists no plugins", () => {
		const bare = createSite(
			defineSite({ collections: { page }, locales: [{ code: "en", name: "English" }], defaultLocale: "en" }),
		);
		expect(bare.getPluginOptions("color")).toBeUndefined();
	});

	it("keeps the options of two sites apart", () => {
		const other = createSite(
			defineSite({
				collections: { page },
				locales: [{ code: "en", name: "English" }],
				defaultLocale: "en",
				plugins: [definePlugin({ name: "color", options: { palette: ["blue"] } })],
			}),
		);
		expect(other.getPluginOptions("color")).toEqual({ palette: ["blue"] });
		expect(site.getPluginOptions("color")).toEqual({ palette: ["red"] });
	});
});
