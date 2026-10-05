import { createActiveTranslator } from "../../i18n/active";
import { codeBlockMessages } from "./messages";

/**
 * Code block line effect definitions (`// @line name {2-4}`). Adds the site config's `codeBlock.lineEffects` to the core defaults
 * (highlight, plus, minus, warning, error). A site definition replaces one with the same name.
 *
 * A definition sets the storage syntax (comment name), public view class, and editor display in one place. It goes into the config, so it holds only
 * JSON-serializable values. Line folding (`collapse`) and the body-link label (`anchor`) are core effects with their own behavior, so they are not here.
 *
 * This file does not read the config (the config file imports this type through the authoring API). The list the site uses is in `active.ts`.
 */

/** Editor display. Kept separate from the public view class (the public view draws line-leading markers with CSS). */
export interface CodeLineEffectEditor {
	/** Line background class. */
	readonly background?: string;
	/** Color class of the wavy underline across the whole line (e.g. `decoration-red-500`). */
	readonly wavy?: string;
	/** Marker text in the line number column and its class (e.g. `+`). If a line has several, the earliest in definition order is shown. */
	readonly marker?: { readonly text: string; readonly className?: string };
}

export interface CodeLineEffectDefinition {
	/** Comment name (`// @line name`). Lowercase kebab-case. */
	readonly name: string;
	/** Line effect menu label. Keep it short. */
	readonly label: string;
	/** Menu icon (lucide name). Must be a name registered in the admin UI. */
	readonly icon?: string;
	/** Class the public view adds to that line. */
	readonly class: string;
	readonly editor?: CodeLineEffectEditor;
}

/**
 * Code block tools the editor offers. All are on unless set to `false`. Turning one off only removes it from the editor's menus, panels
 * and toolbars: a body that already uses it (written before, imported, or typed in the source panel) still reads and renders the same.
 */
export interface CodeBlockFeatures {
	/** Regex rules (`// @char strong {re:/x/g}`) and their panel. */
	readonly rules?: boolean;
	/** Folding: the line menu's "Collapse" (`// @line collapse`) and the fold text effect (`// @char fold`). */
	readonly fold?: boolean;
	/** The tooltip text effect (`// @char Tooltip`). */
	readonly tooltip?: boolean;
	/** Bold, italic, strikethrough and underline inside code (`strong`, `em`, `del`, `u`). */
	readonly textStyles?: boolean;
}

/** Shiki themes for code (names of Shiki's bundled themes, e.g. `github-light`). The public page and the editor use the same pair. */
export interface CodeBlockThemes {
	readonly light: string;
	readonly dark: string;
}

/** The site config's code block settings. */
export interface CodeBlockConfig {
	/** Line effects. Added to the core defaults; same name replaces. The menu is the defaults followed by added ones in order. */
	readonly lineEffects?: readonly CodeLineEffectDefinition[];
	/** Names of line effects the editor does not offer (defaults or added ones). Bodies that use them still render them. */
	readonly omitLineEffects?: readonly string[];
	/** Editor tools to turn off (`{ rules: false }`). */
	readonly features?: CodeBlockFeatures;
	/** Highlighting themes. Defaults to `one-light` and `one-dark-pro`. */
	readonly themes?: CodeBlockThemes;
	/**
	 * More languages to highlight (names or aliases of Shiki's bundled languages, e.g. `elixir`, `zig`), added to the default list. They
	 * are offered in the editor's language list too. Code in a language that is not loaded is shown as plain text.
	 */
	readonly languages?: readonly string[];
}

const t = createActiveTranslator(codeBlockMessages);

/** Core default line effects. Declaration order is the order in the line effect menu. */
export const DEFAULT_CODE_LINE_EFFECTS: readonly CodeLineEffectDefinition[] = [
	{
		name: "highlight",
		get label() {
			return t("lineEffect.highlight");
		},
		icon: "highlighter",
		class: "inline-block w-full anno-mark-base bg-gray-400/20",
		editor: { background: "bg-gray-400/20" },
	},
	{
		name: "plus",
		get label() {
			return t("lineEffect.plus");
		},
		icon: "plus",
		class:
			"inline-block w-full anno-mark-base anno-mark:content-['+'] anno-mark:text-gray-400 bg-green-400/10 shadow-[inset_2px_0_0_0_rgba(74,222,128,1)]",
		editor: {
			background: "bg-green-400/10 shadow-[inset_2px_0_0_0_rgba(74,222,128,1)]",
			marker: { text: "+", className: "text-green-600 cms-dark:text-green-400" },
		},
	},
	{
		name: "minus",
		get label() {
			return t("lineEffect.minus");
		},
		icon: "minus",
		class:
			"inline-block w-full anno-mark-base anno-mark:content-['-'] anno-mark:text-gray-400 bg-red-400/10 shadow-[inset_2px_0_0_0_rgba(239,68,68,1)]",
		editor: {
			background: "bg-red-400/10 shadow-[inset_2px_0_0_0_rgba(239,68,68,1)]",
			marker: { text: "−", className: "text-red-600 cms-dark:text-red-400" },
		},
	},
	{
		name: "warning",
		get label() {
			return t("lineEffect.warning");
		},
		icon: "triangle-alert",
		class: "underline decoration-wavy decoration-yellow-400/80",
		editor: { wavy: "decoration-yellow-400/80" },
	},
	{
		name: "error",
		get label() {
			return t("lineEffect.error");
		},
		icon: "circle-x",
		class: "underline decoration-wavy decoration-red-500",
		editor: { wavy: "decoration-red-500" },
	},
];

/** Names not usable as line effects: core line effects (folding, label) and text effect names. */
const RESERVED = new Set(["collapse", "anchor", "fold", "strong", "em", "del", "u", "tooltip"]);
const NAME = /^[a-z][a-z0-9-]*$/;

/** Default highlighting themes. */
export const DEFAULT_CODE_BLOCK_THEMES: CodeBlockThemes = { light: "one-light", dark: "one-dark-pro" };

const FEATURES = new Set(["rules", "fold", "tooltip", "textStyles"]);
const LANGUAGE = /^[a-z0-9][a-z0-9+#.-]*$/i;

/** Checks that the site config is valid. Reports at app startup if wrong. */
export function validateCodeBlockConfig(config: CodeBlockConfig | undefined): void {
	for (const [key, value] of Object.entries(config?.features ?? {})) {
		if (!FEATURES.has(key)) throw new Error(`cms.config: codeBlock.features.${key}: unknown feature`);
		if (typeof value !== "boolean") throw new Error(`cms.config: codeBlock.features.${key}: must be true or false`);
	}
	for (const name of config?.omitLineEffects ?? []) {
		if (typeof name !== "string" || !NAME.test(name)) {
			throw new Error(`cms.config: codeBlock.omitLineEffects.${String(name)}: name must be lower-case kebab`);
		}
	}
	if (config?.themes) {
		for (const key of ["light", "dark"] as const) {
			const name = config.themes[key];
			if (typeof name !== "string" || !name.trim())
				throw new Error(`cms.config: codeBlock.themes.${key}: theme name is empty`);
		}
	}
	for (const name of config?.languages ?? []) {
		if (typeof name !== "string" || !LANGUAGE.test(name)) {
			throw new Error(`cms.config: codeBlock.languages.${String(name)}: not a language name`);
		}
	}
	const known = new Set(resolveCodeLineEffects(config?.lineEffects).map((effect) => effect.name));
	for (const name of config?.omitLineEffects ?? []) {
		if (!known.has(name)) throw new Error(`cms.config: codeBlock.omitLineEffects.${name}: no such line effect`);
	}
	const seen = new Set<string>();
	for (const effect of config?.lineEffects ?? []) {
		const at = `cms.config: codeBlock.lineEffects.${effect.name}`;
		if (!NAME.test(effect.name)) throw new Error(`${at}: name must be lower-case kebab`);
		if (RESERVED.has(effect.name.toLowerCase())) throw new Error(`${at}: name is reserved`);
		if (seen.has(effect.name)) throw new Error(`${at}: name is duplicated`);
		seen.add(effect.name);
		if (!effect.label.trim()) throw new Error(`${at}: label is empty`);
		if (typeof effect.class !== "string") throw new Error(`${at}: class must be a string`);
	}
}

/** Merges site definitions into the default line effects. A same name is replaced in place; a new name is appended. */
export function resolveCodeLineEffects(
	added: readonly CodeLineEffectDefinition[] | undefined,
): readonly CodeLineEffectDefinition[] {
	const byName = new Map(DEFAULT_CODE_LINE_EFFECTS.map((effect) => [effect.name, effect]));
	for (const effect of added ?? []) byName.set(effect.name, effect);
	return [...byName.values()];
}
