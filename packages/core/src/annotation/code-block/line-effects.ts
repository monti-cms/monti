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

/** The site config's code block settings. */
export interface CodeBlockConfig {
	/** Line effects. Added to the core defaults; same name replaces. The menu is the defaults followed by added ones in order. */
	readonly lineEffects?: readonly CodeLineEffectDefinition[];
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

/** Checks that the site config is valid. Reports at app startup if wrong. */
export function validateCodeBlockConfig(config: CodeBlockConfig | undefined): void {
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
