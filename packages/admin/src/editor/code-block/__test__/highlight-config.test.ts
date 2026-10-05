import { describe, expect, it, vi } from "vitest";
import { codeLanguageChoices } from "../languages";

/** Site config `codeBlock.themes` and `codeBlock.languages` cannot be changed per test (one fixed site config), so the resolved values are replaced here. */
vi.mock("@monti-cms/core/code-block", async (importOriginal) => ({
	...(await importOriginal<typeof import("@monti-cms/core/code-block")>()),
	CODE_BLOCK_THEMES: { light: "github-light", dark: "github-dark" },
	EXTRA_CODE_LANGUAGES: ["elixir", "zig", "ts", "elixir"],
}));

const { CODE_LANGUAGE_CHOICES } = await import("../languages");
const { highlighterOptions, loadExtraLanguages, tokensWithThemes } = await import("../highlight-plugin");

describe("editor highlighting themes", () => {
	it("creates the highlighter with the site's light and dark themes", () => {
		expect(highlighterOptions().themes).toEqual(["github-light", "github-dark"]);
		expect(highlighterOptions().langs).toContain("typescript");
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

	it("uses the theme pair the highlighter was created with when none is given", () => {
		const codeToTokensWithThemes = vi.fn((_code: string, _options: { themes: unknown }) => []);
		tokensWithThemes({ codeToTokensWithThemes } as never, "typescript", "x");
		const call = codeToTokensWithThemes.mock.calls[0] as [string, { themes: unknown }];
		expect(call[1].themes).toEqual({ light: "github-light", dark: "github-dark" });
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
		await loadExtraLanguages({ loadLanguage } as never);
		expect(loadLanguage.mock.calls.map(([name]) => name)).toEqual(["elixir", "zig", "ts", "elixir"]);
	});
});

describe("language dropdown", () => {
	it("lists the default languages followed by the extra ones that are not in it, labeled by name", () => {
		const values = CODE_LANGUAGE_CHOICES.map((option) => option.value);
		expect(values.slice(-2)).toEqual(["elixir", "zig"]);
		// "ts" is already in the default list, and a repeated name is listed once.
		expect(values.filter((value) => value === "ts")).toHaveLength(1);
		expect(values.filter((value) => value === "elixir")).toHaveLength(1);
		expect(CODE_LANGUAGE_CHOICES.at(-1)).toEqual({ label: "zig", value: "zig" });
		expect(CODE_LANGUAGE_CHOICES[0]).toEqual({ label: "TypeScript", value: "ts" });
	});

	it("is only the default list when there are no extra languages", () => {
		expect(codeLanguageChoices([])).toHaveLength(CODE_LANGUAGE_CHOICES.length - 2);
	});
});
