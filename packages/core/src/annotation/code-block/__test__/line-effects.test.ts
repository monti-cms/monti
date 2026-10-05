import { describe, expect, it } from "vitest";
import { createTranslator } from "../../../i18n";
import {
	annotationConfig,
	CODE_BLOCK_FEATURES,
	CODE_BLOCK_THEMES,
	CODE_LINE_EFFECTS,
	isLineEffectName,
	OFFERED_LINE_EFFECTS,
	offersCharEffect,
} from "../active";
import { fromCodeFenceToCodeBlockDocument } from "../code-fence-to-document";
import { createAnnotationConfig } from "../constants";
import { fromCodeBlockDocumentToCodeFence } from "../document-to-code-fence";
import { DEFAULT_CODE_LINE_EFFECTS, resolveCodeLineEffects, validateCodeBlockConfig } from "../line-effects";
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
		// A config without line effects (the example site) stays at the defaults.
		expect(CODE_LINE_EFFECTS).toEqual(DEFAULT_CODE_LINE_EFFECTS);
		expect(byName(annotationConfig.annotations)).toEqual(byName(BEFORE));
		// Menu labels are short, without parentheses.
		const t = createTranslator(codeBlockMessages);
		expect(DEFAULT_CODE_LINE_EFFECTS.map((effect) => effect.label)).toEqual([
			t("lineEffect.highlight"),
			t("lineEffect.focus"),
			t("lineEffect.plus"),
			t("lineEffect.minus"),
			t("lineEffect.warning"),
			t("lineEffect.error"),
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
		expect(isLineEffectName("plus")).toBe(true);
		expect(isLineEffectName("collapse")).toBe(true);
		expect(isLineEffectName("anchor")).toBe(true);
		expect(isLineEffectName("focus")).toBe(true);
		expect(isLineEffectName("info")).toBe(false);
	});

	it("an invalid config is reported immediately", () => {
		expect(() => validateCodeBlockConfig({ lineEffects: [{ name: "Focus", label: "초점", class: "" }] })).toThrow(
			/lower-case kebab/,
		);
		expect(() => validateCodeBlockConfig({ lineEffects: [{ name: "collapse", label: "접기", class: "" }] })).toThrow(
			/reserved/,
		);
		expect(() =>
			validateCodeBlockConfig({
				lineEffects: [
					{ name: "focus", label: "초점", class: "a" },
					{ name: "focus", label: "초점", class: "b" },
				],
			}),
		).toThrow(/duplicated/);
		expect(() => validateCodeBlockConfig({ lineEffects: [{ name: "focus", label: " ", class: "a" }] })).toThrow(
			/label/,
		);
		expect(() => validateCodeBlockConfig(undefined)).not.toThrow();
	});
});

describe("code block options of the site config", () => {
	it("are all on by default, with the default themes and every line effect offered", () => {
		expect(CODE_BLOCK_FEATURES).toEqual({ rules: true, fold: true, tooltip: true, textStyles: true });
		expect(OFFERED_LINE_EFFECTS).toEqual(CODE_LINE_EFFECTS);
		expect(["strong", "em", "del", "u", "Tooltip", "fold"].every(offersCharEffect)).toBe(true);
		expect(CODE_BLOCK_THEMES).toEqual({ light: "one-light", dark: "one-dark-pro" });
	});

	it("accept switches, omitted line effects, themes and languages", () => {
		expect(() =>
			validateCodeBlockConfig({
				lineEffects: [{ name: "focus", label: "Focus", class: "a" }],
				omitLineEffects: ["warning", "focus"],
				features: { rules: false, fold: false, tooltip: true, textStyles: false },
				themes: { light: "github-light", dark: "github-dark" },
				languages: ["elixir", "c++", "f#"],
			}),
		).not.toThrow();
	});

	it("report a wrong value at startup", () => {
		expect(() => validateCodeBlockConfig({ features: { comments: false } as never })).toThrow(
			/features\.comments: unknown feature/,
		);
		expect(() => validateCodeBlockConfig({ features: { rules: "no" } as never })).toThrow(/true or false/);
		expect(() => validateCodeBlockConfig({ omitLineEffects: ["info"] })).toThrow(/no such line effect/);
		expect(() => validateCodeBlockConfig({ themes: { light: "github-light", dark: " " } })).toThrow(
			/themes\.dark: theme name is empty/,
		);
		expect(() => validateCodeBlockConfig({ languages: ["not a language"] })).toThrow(/not a language name/);
	});
});
