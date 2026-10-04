import { type DecorationItem, type LanguageInput, type ThemeRegistrationAny } from "shiki/core";
import { type LineDecorationPayload, type LineWrapperPayload, type Meta } from "./transformers.js";
export declare const CODE_BLOCK_THEME_DARK: string;
export declare const CODE_BLOCK_THEME_LIGHT: string;
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
    themes?: {
        light: ThemeRegistrationAny;
        dark: ThemeRegistrationAny;
    };
    /** Language aliases. Defaults to `DEFAULT_CODE_LANG_ALIAS`. */
    langAlias?: Record<string, string>;
};
export type CodeHighlighter = Awaited<ReturnType<typeof createCodeHighlighter>>;
export type HighlightFn = CodeHighlighter["highlight"];
/** Creates a code block highlighter with the languages and themes given by options. Without options, it uses the reference defaults (one-light, one-dark-pro). */
export declare const createCodeHighlighter: (options?: CodeHighlighterOptions) => Promise<{
    highlight: (code: string, lang: string, meta: Meta, annotationPayload?: AnnotationPayload) => import("hast").Root;
}>;
export declare const langAlias: Record<string, string>;
/** Highlighter with default options. */
export declare const highlight: (code: string, lang: string, meta: Meta, annotationPayload?: AnnotationPayload) => import("hast").Root;
