import { createSite } from "@monti-cms/core/client";
import { describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../../../core/test/site";
import { getShikiHighlighter, highlighterOptions, loadExtraLanguages, tokensWithThemes } from "../highlight-plugin";
import { codeLanguageChoices } from "../languages";

/** A site whose `codeBlock.themes` and `codeBlock.languages` are set by the test, on top of the test site config. */
const siteWith = (codeBlock: { themes?: { light: string; dark: string }; languages?: string[] }) =>
	createSite({ ...testConfig, codeBlock });

const site = siteWith({
	themes: { light: "github-light", dark: "github-dark" },
	languages: ["elixir", "zig", "ts", "elixir"],
});

describe("editor highlighting themes", () => {
	it("creates the highlighter with the site's light and dark themes", () => {
		expect(highlighterOptions(site.CODE_BLOCK_THEMES).themes).toEqual(["github-light", "github-dark"]);
		expect(highlighterOptions(site.CODE_BLOCK_THEMES).langs).toContain("typescript");
	});

	it("loads one theme once when light and dark are the same", () => {
		expect(highlighterOptions({ light: "nord", dark: "nord" }).themes).toEqual(["nord"]);
	});

	it("tokenizes with the configured theme names instead of the defaults", () => {
		const codeToTokensWithThemes = vi.fn(() => []);
		tokensWithThemes({ codeToTokensWithThemes } as never, "typescript", "const a = 1;", {
			light: "github-light",
			dark: "github-dark",
		});
		expect(codeToTokensWithThemes).toHaveBeenCalledWith("const a = 1;", {
			lang: "typescript",
			themes: { light: "github-light", dark: "github-dark" },
		});
	});

	it("falls back to the default themes when the site's theme names are not Shiki themes", async () => {
		const broken = siteWith({ themes: { light: "no-such-light", dark: "no-such-dark" } });
		const highlighter = await getShikiHighlighter(broken);
		expect(highlighter.getLoadedThemes()).toEqual(expect.arrayContaining(["one-light", "one-dark-pro"]));
	});
});

describe("editor extra languages", () => {
	it("loads the site's extra languages and skips one Shiki does not know without failing", async () => {
		const loadLanguage = vi.fn(async (name: string) => {
			if (name === "nope") throw new Error("unknown language");
		});
		const loaded = await loadExtraLanguages({ loadLanguage } as never, ["elixir", "nope", "zig"]);
		expect(loaded).toEqual(["elixir", "zig"]);
		expect(loadLanguage).toHaveBeenCalledTimes(3);
	});

	it("loads the configured languages by default", async () => {
		const loadLanguage = vi.fn(async (_name: string) => undefined);
		await loadExtraLanguages({ loadLanguage } as never, site.EXTRA_CODE_LANGUAGES);
		expect(loadLanguage.mock.calls.map(([name]) => name)).toEqual(["elixir", "zig", "ts", "elixir"]);
	});
});

describe("language dropdown", () => {
	it("lists the default languages followed by the extra ones that are not in it, labeled by name", () => {
		const choices = codeLanguageChoices(site.EXTRA_CODE_LANGUAGES);
		const values = choices.map((option) => option.value);
		expect(values.slice(-2)).toEqual(["elixir", "zig"]);
		// "ts" is already in the default list, and a repeated name is listed once.
		expect(values.filter((value) => value === "ts")).toHaveLength(1);
		expect(values.filter((value) => value === "elixir")).toHaveLength(1);
		expect(choices.at(-1)).toEqual({ label: "zig", value: "zig" });
		expect(choices[0]).toEqual({ label: "TypeScript", value: "ts" });
	});

	it("is only the default list when there are no extra languages", () => {
		expect(codeLanguageChoices([])).toHaveLength(codeLanguageChoices(site.EXTRA_CODE_LANGUAGES).length - 2);
	});
});
