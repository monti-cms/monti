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
	/** 불러올 언어. 기본은 `DEFAULT_CODE_LANGS`. */
	langs?: LanguageInput[];
	/** 밝은·어두운 테마. 기본은 `DEFAULT_CODE_THEMES`(one-light·one-dark-pro). */
	themes?: { light: ThemeRegistrationAny; dark: ThemeRegistrationAny };
	/** 언어 별칭. 기본은 `DEFAULT_CODE_LANG_ALIAS`. */
	langAlias?: Record<string, string>;
};

export type CodeHighlighter = Awaited<ReturnType<typeof createCodeHighlighter>>;

export type HighlightFn = CodeHighlighter["highlight"];

const themeName = (theme: ThemeRegistrationAny) => (theme.name ?? "") as string;

/** 옵션으로 언어·테마를 정해 코드 블록 강조기를 만든다. 옵션을 안 주면 블로그 기본값(one-light·one-dark-pro)이다. */
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

/** 기본 옵션 강조기. */
export const highlight = defaultHighlighter.highlight;
