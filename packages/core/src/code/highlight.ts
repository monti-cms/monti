import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { bundledLanguages, bundledLanguagesInfo } from "shiki/langs";
import { bundledThemes } from "shiki/themes";
import { MONTI_CODE_THEMES } from "./monti-theme.generated";
import { type CodeBlockConfig, codeBlockSettings, DEFAULT_CODE_THEMES } from "./settings";

/** A piece of a line in one colour: the light theme's and the dark theme's. */
export type CodeToken = {
	text: string;
	light?: string;
	dark?: string;
	/** The theme's font style for the piece (Shiki's flags: 1 italic, 2 bold), the light theme's first. */
	fontStyle?: number;
};

/**
 * Colours code: what `renderDocument` and the editor ask of a highlighter (doc 17). `lines` is synchronous; a language that is not loaded comes back
 * as plain text, one token per line.
 */
export type CodeColors = {
	lines: (code: string, language: string | undefined) => CodeToken[][];
	/** Whether the language is loaded. */
	has: (language: string | undefined) => boolean;
	/** Loads a language Shiki has (the editor loads a block's language when it first draws it); `false` for a name Shiki does not know. */
	load: (language: string) => Promise<boolean>;
	themes: { light: string; dark: string };
	/** The classes the site's own line effects put on their lines (`codeBlock.lineEffects`' `class`). */
	lineClasses: Readonly<Record<string, string>>;
};

/** The display name of a Shiki language (`ts` → `TypeScript`), or the name itself. */
export function languageName(id: string): string {
	const info = bundledLanguagesInfo.find((each) => each.id === id || each.aliases?.includes(id));
	return info?.name ?? id;
}

/** Whether Shiki knows the language by that name or alias. */
export const knownLanguage = (id: string) => id in bundledLanguages;

/** The font style flags that reach a page: italic (1) and bold (2). */
const styleOf = (variants: Record<string, { fontStyle?: number } | undefined>) =>
	((variants.light?.fontStyle ?? variants.dark?.fontStyle ?? 0) & 3) as 0 | 1 | 2 | 3;

const plain = (code: string): CodeToken[][] => code.split("\n").map((text) => (text ? [{ text }] : []));

/** A highlighter over a Shiki core: the site's server opens one; the editor opens one and loads languages as blocks need them. */
export function colorsOf(
	highlighter: HighlighterCore,
	themes: { light: string; dark: string },
	lineClasses: Readonly<Record<string, string>> = {},
): CodeColors {
	const has = (language: string | undefined) =>
		!!language && highlighter.getLoadedLanguages().includes(language as never);
	return {
		themes,
		lineClasses,
		has,
		load: (language) => loadLanguage(highlighter, language).catch(() => false),
		lines(code, language) {
			if (!language || !has(language)) return plain(code);
			return highlighter
				.codeToTokensWithThemes(code, { lang: language, themes: { light: themes.light, dark: themes.dark } })
				.map((line) =>
					line.map((token) => ({
						text: token.content,
						...(token.variants.light?.color ? { light: token.variants.light.color } : {}),
						...(token.variants.dark?.color ? { dark: token.variants.dark.color } : {}),
						...(styleOf(token.variants) ? { fontStyle: styleOf(token.variants) } : {}),
					})),
				);
		},
	};
}

/** Loads one language into a highlighter if Shiki has it; the names Shiki does not know are left out. */
export async function loadLanguage(highlighter: HighlighterCore, language: string): Promise<boolean> {
	if (highlighter.getLoadedLanguages().includes(language as never)) return true;
	const load = bundledLanguages[language as keyof typeof bundledLanguages];
	if (!load) return false;
	await highlighter.loadLanguage(load);
	return true;
}

/**
 * The site's code colours (doc 17): Shiki with the JavaScript regex engine, the site's two themes and only its languages. Open it once on the server and
 * give it to `renderDocument` as `code`. The editor uses the same themes and loads the same languages one by one.
 */
export async function codeHighlighter(
	config: CodeBlockConfig = {},
	/** `lazy`: no language up front; `load` brings each one when a block needs it (the editor). */
	{ lazy = false }: { lazy?: boolean } = {},
): Promise<CodeColors> {
	const settings = codeBlockSettings(config);
	// Monti's own pair (made from the design tokens) is the default; a site names any other Shiki theme.
	const theme = (name: string) =>
		name in MONTI_CODE_THEMES
			? () => MONTI_CODE_THEMES[name as keyof typeof MONTI_CODE_THEMES]
			: bundledThemes[name as keyof typeof bundledThemes];
	const themes = {
		light: theme(settings.themes.light) ? settings.themes.light : DEFAULT_CODE_THEMES.light,
		dark: theme(settings.themes.dark) ? settings.themes.dark : DEFAULT_CODE_THEMES.dark,
	};
	const highlighter = await createHighlighterCore({
		engine: createJavaScriptRegexEngine({ forgiving: true }),
		themes: [theme(themes.light)() as never, theme(themes.dark)() as never],
		langs: (lazy ? [] : settings.languages)
			.map((name) => bundledLanguages[name as keyof typeof bundledLanguages])
			.filter((load) => load !== undefined)
			.map((load) => load()),
	});
	return colorsOf(
		highlighter,
		themes,
		Object.fromEntries(settings.lineEffects.flatMap((each) => (each.class ? [[each.name, each.class]] : []))),
	);
}
