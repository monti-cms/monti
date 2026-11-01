import { describe, expect, it } from "vitest";
import { testSite } from "../../../../test/site";
import { fromCodeFenceToCodeBlockDocument } from "../code-fence-to-document";
import { createAnnotationConfig } from "../constants";
import { fromCodeBlockDocumentToCodeFence } from "../document-to-code-fence";
import { checkCodeBlockConfig, resolveCodeLineEffects } from "../line-effects";

describe("code line effect definitions", () => {
	it("FMT-C2 a site definition replaces the same name in place and appends a new name", () => {
		const effects = resolveCodeLineEffects([
			{ name: "highlight", label: "강조", class: "my-highlight" },
			{ name: "info", label: "정보", icon: "star", class: "my-info", editor: { background: "bg-primary/10" } },
		]);
		expect(effects.map((effect) => effect.name)).toEqual([
			"highlight",
			"focus",
			"plus",
			"minus",
			"warning",
			"error",
			"info",
		]);
		expect(effects[0]?.class).toBe("my-highlight");

		const config = createAnnotationConfig(effects);
		const value = ["// @line info {0-0}", "const a = 1;"].join("\n");
		const document = fromCodeFenceToCodeBlockDocument({ type: "code", lang: "ts", value }, config);
		expect(document.annotations).toEqual([expect.objectContaining({ name: "info", class: "my-info" })]);
		expect(fromCodeBlockDocumentToCodeFence(document, config).value).toBe(value);
	});

	it("CONF-A1 an invalid config is reported with the path of each value", () => {
		const codes = (config: Parameters<typeof checkCodeBlockConfig>[0]) =>
			checkCodeBlockConfig(config).map((issue) => `${issue.path}:${issue.code}`);
		expect(codes({ lineEffects: [{ name: "Focus", label: "Focus", class: "" }] })).toEqual([
			"codeBlock.lineEffects[0].name:name",
		]);
		expect(codes({ lineEffects: [{ name: "collapse", label: "Fold", class: "" }] })).toEqual([
			"codeBlock.lineEffects[0].name:reserved",
		]);
		expect(
			codes({
				lineEffects: [
					{ name: "focus", label: "Focus", class: "a" },
					{ name: "focus", label: "Focus", class: "b" },
				],
			}),
		).toEqual(["codeBlock.lineEffects[1].name:duplicate"]);
		expect(codes({ lineEffects: [{ name: "focus", label: " ", class: "a" }] })).toEqual([
			"codeBlock.lineEffects[0].label:empty",
		]);
		expect(checkCodeBlockConfig(undefined)).toEqual([]);
	});
});

describe("code block options of the site config", () => {
	it("FMT-C2 are all on by default, with the default themes and every line effect offered", () => {
		expect(testSite.CODE_BLOCK_FEATURES).toEqual({ rules: true, fold: true, tooltip: true, textStyles: true });
		expect(testSite.OFFERED_LINE_EFFECTS).toEqual(testSite.CODE_LINE_EFFECTS);
		expect(["strong", "em", "del", "u", "Tooltip", "fold"].every(testSite.offersCharEffect)).toBe(true);
		expect(testSite.CODE_BLOCK_THEMES).toEqual({ light: "one-light", dark: "one-dark-pro" });
	});

	it("CONF-A1 accept switches, omitted line effects, themes and languages", () => {
		expect(
			checkCodeBlockConfig({
				lineEffects: [{ name: "focus", label: "Focus", class: "a" }],
				omitLineEffects: ["warning", "focus"],
				features: { rules: false, fold: false, tooltip: true, textStyles: false },
				themes: { light: "github-light", dark: "github-dark" },
				languages: ["elixir", "c++", "f#"],
			}),
		).toEqual([]);
	});

	it("CONF-A1 report a wrong value at startup", () => {
		const codes = (config: Parameters<typeof checkCodeBlockConfig>[0]) =>
			checkCodeBlockConfig(config).map((issue) => `${issue.path}:${issue.code}`);
		expect(codes({ features: { comments: false } as never })).toEqual(["codeBlock.features.comments:unknown-key"]);
		expect(codes({ features: { rules: "no" } as never })).toEqual(["codeBlock.features.rules:type"]);
		expect(codes({ omitLineEffects: ["info"] })).toEqual(["codeBlock.omitLineEffects[0]:unknown-effect"]);
		expect(codes({ themes: { light: "github-light", dark: " " } })).toEqual(["codeBlock.themes.dark:empty"]);
		expect(codes({ languages: ["not a language"] })).toEqual(["codeBlock.languages[0]:name"]);
		expect(codes({ theme: {} } as never)).toEqual(["codeBlock.theme:unknown-key"]);
	});
});
