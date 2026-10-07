import { transformerRenderIndentGuides } from "@shikijs/transformers";
import {
	type DecorationItem,
	getSingletonHighlighterCore,
	type LanguageInput,
	type ThemeRegistrationAny,
} from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import { bundledLanguages } from "shiki/langs";
import { bundledThemes } from "shiki/themes";
import type { CodeBlockThemes } from "../../annotation/code-block/line-effects";
import type { Site } from "../../site";
import { perSite } from "../../site/per-site";
import { DEFAULT_CODE_LANG_ALIAS, DEFAULT_CODE_LANGS, DEFAULT_CODE_THEMES } from "./default-code-options";
import {
	addLineDecorations,
	addLineNumbers,
	addLineWrappers,
	addMetaToPre,
	convertInlineAnnoToRenderTag,
	type LineDecorationPayload,
	type LineWrapperPayload,
	type Meta,
	numberCodeNotes,
	showsLineNumbers,
} from "./transformers";

export type AnnotationPayload = {
	decorations?: DecorationItem[];
	lineDecorations?: LineDecorationPayload[];
	rowWrappers?: LineWrapperPayload[];
	allowedRenderTags?: string[];
};

export type CodeHighlighterOptions = {
	/** Languages to load. Defaults to `DEFAULT_CODE_LANGS`. */
	langs?: LanguageInput[];
	/** Light and dark themes. Defaults to `DEFAULT_CODE_THEMES` (one-light, one-dark-pro). */
	themes?: { light: ThemeRegistrationAny; dark: ThemeRegistrationAny };
	/** Language aliases. Defaults to `DEFAULT_CODE_LANG_ALIAS`. */
	langAlias?: Record<string, string>;
};

export type CodeHighlighter = Awaited<ReturnType<typeof createCodeHighlighter>>;

export type HighlightFn = CodeHighlighter["highlight"];

/** Code highlighting settings (languages, themes, aliases). Reference defaults if not given. */
export type CodeHighlightOptions = CodeHighlighterOptions & {
	ignoreLang?: (lang: string) => boolean;
	/** Function that highlights code. If given, `langs`, `themes` and `langAlias` are not used. */
	highlight?: HighlightFn;
};

const themeName = (theme: ThemeRegistrationAny) => (theme.name ?? "") as string;

/** Creates a code block highlighter with the languages and themes given by options. Without options, it uses the reference defaults (one-light, one-dark-pro). */
export const createCodeHighlighter = async (options: CodeHighlighterOptions = {}) => {
	const themes = options.themes ?? DEFAULT_CODE_THEMES;

	const highlighter = await getSingletonHighlighterCore({
		themes: [themes.light, themes.dark],
		langs: options.langs ?? DEFAULT_CODE_LANGS,
		langAlias: options.langAlias ?? DEFAULT_CODE_LANG_ALIAS,
		engine: await createOnigurumaEngine(import("shiki/wasm")),
	});

	/** A language that is not loaded is shown as plain text: one unknown fence language must not fail the whole page. */
	const loadedLang = (lang: string) => {
		try {
			highlighter.getLanguage(lang);
			return lang;
		} catch {
			return "text";
		}
	};

	const highlight = (code: string, lang: string, meta: Meta, annotationPayload: AnnotationPayload = {}) => {
		const { decorations = [], lineDecorations = [], rowWrappers = [], allowedRenderTags = [] } = annotationPayload;

		return highlighter.codeToHast(code, {
			lang: lang === "text" ? lang : loadedLang(lang),
			themes: {
				light: themeName(themes.light),
				dark: themeName(themes.dark),
			},
			decorations,
			transformers: [
				// Phase order by hook: line -> pre -> root
				transformerRenderIndentGuides(),
				addLineDecorations(lineDecorations),
				addMetaToPre(code, meta),
				convertInlineAnnoToRenderTag(allowedRenderTags),
				addLineWrappers(rowWrappers, allowedRenderTags),
				numberCodeNotes(),
				...(showsLineNumbers(meta) ? [addLineNumbers()] : []),
			],
		});
	};

	return { highlight };
};

export const langAlias = DEFAULT_CODE_LANG_ALIAS;

const loadTheme = async (key: keyof CodeBlockThemes, name: string): Promise<ThemeRegistrationAny> => {
	const fallback = DEFAULT_CODE_THEMES[key];
	if (name === themeName(fallback)) return fallback;
	const load = bundledThemes[name as keyof typeof bundledThemes];
	if (!load) throw new Error(`cms.config: codeBlock.themes.${key}: "${name}" is not a Shiki theme`);
	return (await load()).default;
};

const loadLanguage = async (name: string): Promise<LanguageInput> => {
	const load = bundledLanguages[name as keyof typeof bundledLanguages];
	if (!load) throw new Error(`cms.config: codeBlock.languages.${name}: "${name}" is not a Shiki language`);
	return (await load()).default;
};

/** The parts of a site the highlighter is built from: its themes and extra languages (`codeBlock.themes`, `codeBlock.languages`). */
export type HighlightSite = Pick<Site, "CODE_BLOCK_THEMES" | "EXTRA_CODE_LANGUAGES">;

/** Highlighter options of a site (`codeBlock.themes`, `codeBlock.languages` on top of the default list). */
export const siteCodeHighlighterOptions = async (site: HighlightSite): Promise<CodeHighlighterOptions> => ({
	themes: {
		light: await loadTheme("light", site.CODE_BLOCK_THEMES.light),
		dark: await loadTheme("dark", site.CODE_BLOCK_THEMES.dark),
	},
	langs: [...DEFAULT_CODE_LANGS, ...(await Promise.all(site.EXTRA_CODE_LANGUAGES.map(loadLanguage)))],
});

/**
 * The highlighter of a site: its themes and languages (`codeBlock`, else the reference defaults), created on first use and kept for that site. Two sites with
 * different themes in one process each get their own (they share Shiki's loaded themes and languages, not their settings).
 */
export const siteHighlight = perSite(
	async (site: HighlightSite): Promise<HighlightFn> =>
		(await createCodeHighlighter(await siteCodeHighlighterOptions(site))).highlight,
);
