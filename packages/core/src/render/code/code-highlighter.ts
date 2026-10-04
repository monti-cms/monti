import { transformerRenderIndentGuides } from "@shikijs/transformers";
import {
	type DecorationItem,
	getSingletonHighlighterCore,
	type LanguageInput,
	type ThemeRegistrationAny,
} from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
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

export const CODE_BLOCK_THEME_DARK = DEFAULT_CODE_THEMES.dark.name as string;
export const CODE_BLOCK_THEME_LIGHT = DEFAULT_CODE_THEMES.light.name as string;

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

	const highlight = (code: string, lang: string, meta: Meta, annotationPayload: AnnotationPayload = {}) => {
		const { decorations = [], lineDecorations = [], rowWrappers = [], allowedRenderTags = [] } = annotationPayload;

		return highlighter.codeToHast(code, {
			lang,
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

const defaultHighlighter = await createCodeHighlighter();

/** Highlighter with default options. */
export const highlight = defaultHighlighter.highlight;
