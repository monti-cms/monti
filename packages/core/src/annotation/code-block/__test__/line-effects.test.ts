import { describe, expect, it } from "vitest";
import { testSite } from "../../../../test/site";
import { createTranslator } from "../../../i18n";
import { fromCodeFenceToCodeBlockDocument } from "../code-fence-to-document";
import { createAnnotationConfig } from "../constants";
import { fromCodeBlockDocumentToCodeFence } from "../document-to-code-fence";
import { checkCodeBlockConfig, DEFAULT_CODE_LINE_EFFECTS, resolveCodeLineEffects } from "../line-effects";
import { codeBlockMessages } from "../messages";
import type { AnnotationConfigItem } from "../types";

/** The annotation config before switching to a definition list (checks the public view classes stay the same), plus `focus`, added later. */
const BEFORE: AnnotationConfigItem[] = [
	{ name: "Tooltip", kind: "render", source: "mdx-text", render: "Tooltip", scopes: ["char", "document"] },
	{ name: "strong", kind: "render", source: "mdx-text", render: "strong", scopes: ["char", "document"] },
	{ name: "em", kind: "render", source: "mdx-text", render: "em", scopes: ["char", "document"] },
	{ name: "del", kind: "render", source: "mdx-text", render: "del", scopes: ["char", "document"] },
	{ name: "u", kind: "render", source: "mdx-text", render: "u", scopes: ["char", "document"] },
	{ name: "fold", kind: "render", source: "mdx-text", render: "fold", scopes: ["char", "document"] },
	{
		name: "plus",
		kind: "class",
		class:
			"inline-block w-full anno-mark-base anno-mark:content-['+'] anno-mark:text-gray-400 bg-green-400/10 shadow-[inset_2px_0_0_0_rgba(74,222,128,1)]",
		scopes: ["line"],
	},
	{
		name: "minus",
		kind: "class",
		class:
			"inline-block w-full anno-mark-base anno-mark:content-['-'] anno-mark:text-gray-400 bg-red-400/10 shadow-[inset_2px_0_0_0_rgba(239,68,68,1)]",
		scopes: ["line"],
	},
	{ name: "highlight", kind: "class", class: "inline-block w-full anno-mark-base bg-gray-400/20", scopes: ["line"] },
	{ name: "focus", kind: "class", class: "code-focus", scopes: ["line"] },
	{ name: "warning", kind: "class", class: "underline decoration-wavy decoration-yellow-400/80", scopes: ["line"] },
	{ name: "error", kind: "class", class: "underline decoration-wavy decoration-red-500", scopes: ["line"] },
	{ name: "collapse", kind: "render", render: "collapse", scopes: ["line"] },
	{ name: "anchor", kind: "class", class: "code-anchor", scopes: ["line"] },
];

const byName = (items: readonly AnnotationConfigItem[] | undefined) =>
	Object.fromEntries((items ?? []).map((item) => [item.name, item]));

describe("code line effect definitions", () => {
	it("the default definitions produce the same names and classes as the old annotation config", () => {
		expect(byName(createAnnotationConfig().annotations)).toEqual(byName(BEFORE));
		// A config without line effects (the example site) stays at the defaults. The site's labels are in its admin language, the defaults' in English.
		const t = testSite.createTranslator(codeBlockMessages);
		const tEn = createTranslator(codeBlockMessages, "en");
		expect(testSite.CODE_LINE_EFFECTS).toEqual(
			DEFAULT_CODE_LINE_EFFECTS.map((effect) => ({ ...effect, label: t(`lineEffect.${effect.name}` as never) })),
		);
		expect(byName(testSite.annotationConfig.annotations)).toEqual(byName(BEFORE));
		// Menu labels are short, without parentheses.
		expect(DEFAULT_CODE_LINE_EFFECTS.map((effect) => effect.label)).toEqual([
			tEn("lineEffect.highlight"),
			tEn("lineEffect.focus"),
			tEn("lineEffect.plus"),
			tEn("lineEffect.minus"),
			tEn("lineEffect.warning"),
			tEn("lineEffect.error"),
		]);
	});

	it("a site definition replaces the same name in place and appends a new name", () => {
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

	it("the editor recognizes only defined line effects plus folding and the label", () => {
		expect(testSite.isLineEffectName("plus")).toBe(true);
		expect(testSite.isLineEffectName("collapse")).toBe(true);
		expect(testSite.isLineEffectName("anchor")).toBe(true);
		expect(testSite.isLineEffectName("focus")).toBe(true);
		expect(testSite.isLineEffectName("info")).toBe(false);
	});

	it("an invalid config is reported with the path of each value", () => {
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
	it("are all on by default, with the default themes and every line effect offered", () => {
		expect(testSite.CODE_BLOCK_FEATURES).toEqual({ rules: true, fold: true, tooltip: true, textStyles: true });
		expect(testSite.OFFERED_LINE_EFFECTS).toEqual(testSite.CODE_LINE_EFFECTS);
		expect(["strong", "em", "del", "u", "Tooltip", "fold"].every(testSite.offersCharEffect)).toBe(true);
		expect(testSite.CODE_BLOCK_THEMES).toEqual({ light: "one-light", dark: "one-dark-pro" });
	});

	it("accept switches, omitted line effects, themes and languages", () => {
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

	it("report a wrong value at startup", () => {
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
