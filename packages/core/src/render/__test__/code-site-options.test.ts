import { describe, expect, it, vi } from "vitest";

// The site config of the test site uses the defaults, so the resolved options are replaced here.
vi.mock("../../annotation/code-block/active", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../annotation/code-block/active")>()),
	CODE_BLOCK_THEMES: { light: "github-light", dark: "github-dark" },
	EXTRA_CODE_LANGUAGES: ["elixir"],
}));

describe("the site's code block themes and languages", () => {
	it("highlight with the configured themes and an added language", async () => {
		const { CODE_BLOCK_THEME_DARK, CODE_BLOCK_THEME_LIGHT, highlight, siteCodeHighlighterOptions } = await import(
			"../code/code-highlighter"
		);
		expect([CODE_BLOCK_THEME_LIGHT, CODE_BLOCK_THEME_DARK]).toEqual(["github-light", "github-dark"]);
		const options = await siteCodeHighlighterOptions();
		expect([options.themes?.light.name, options.themes?.dark.name]).toEqual(["github-light", "github-dark"]);

		const html = JSON.stringify(highlight('defmodule Hello do\n  def hi, do: "hi"\nend', "elixir", {}));
		// github-dark's keyword color, which one-dark-pro does not use.
		expect(html).toContain("--shiki-dark:#F97583");
	});
});
