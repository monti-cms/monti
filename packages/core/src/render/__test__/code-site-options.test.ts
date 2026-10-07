import { describe, expect, it } from "vitest";
import { defineConfig } from "../../config/define";
import { defineCollection } from "../../schema/collection";
import { fields } from "../../schema/fields";
import { createSite } from "../../site";
import { siteCodeHighlighterOptions, siteHighlight } from "../code/code-highlighter";

const collections = {
	page: defineCollection({
		label: "Page",
		kind: "document",
		path: "/:slug",
		fields: {
			title: fields.text({ label: "Title", required: true }),
			slug: fields.slug({ label: "Slug", from: "title", required: true }),
		},
	}),
};
const locales = [{ code: "en", name: "English" }];

const siteWith = (codeBlock?: Parameters<typeof defineConfig>[0]["codeBlock"]) =>
	createSite(defineConfig({ collections, locales, defaultLocale: "en", codeBlock }));

const ELIXIR = 'defmodule Hello do\n  def hi, do: "hi"\nend';

describe("the site's code block themes and languages", () => {
	it("highlight with the configured themes and an added language", async () => {
		const site = siteWith({ themes: { light: "github-light", dark: "github-dark" }, languages: ["elixir"] });
		const options = await siteCodeHighlighterOptions(site);
		expect([options.themes?.light.name, options.themes?.dark.name]).toEqual(["github-light", "github-dark"]);

		const highlight = await siteHighlight(site);
		const html = JSON.stringify(highlight(ELIXIR, "elixir", {}));
		// github-dark's keyword color, which one-dark-pro does not use.
		expect(html).toContain("--shiki-dark:#F97583");
	});

	it("keeps the default themes for a site that sets none", async () => {
		const site = siteWith();
		const options = await siteCodeHighlighterOptions(site);
		expect([options.themes?.light.name, options.themes?.dark.name]).toEqual(["one-light", "one-dark-pro"]);
	});

	it("builds one highlighter per site, each with its own themes", async () => {
		const github = siteWith({ themes: { light: "github-light", dark: "github-dark" } });
		const plain = siteWith();
		expect(await siteHighlight(github)).toBe(await siteHighlight(github));
		expect(await siteHighlight(github)).not.toBe(await siteHighlight(plain));
		const code = "const a = 1;";
		const withGithub = JSON.stringify((await siteHighlight(github))(code, "ts", {}));
		const withDefault = JSON.stringify((await siteHighlight(plain))(code, "ts", {}));
		expect(withGithub).toContain("github-dark");
		expect(withDefault).toContain("one-dark-pro");
	});
});
