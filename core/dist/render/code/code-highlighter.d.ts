import { type DecorationItem, type LanguageInput, type ThemeRegistrationAny } from "shiki/core";
import type { Site } from "../../site/index.js";
import { type LineDecorationPayload, type LineWrapperPayload, type Meta } from "./transformers.js";
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
/** Code highlighting settings (languages, themes, aliases). Reference defaults if not given. */
export type CodeHighlightOptions = CodeHighlighterOptions & {
    ignoreLang?: (lang: string) => boolean;
    /** Function that highlights code. If given, `langs`, `themes` and `langAlias` are not used. */
    highlight?: HighlightFn;
};
/** Creates a code block highlighter with the languages and themes given by options. Without options, it uses the reference defaults (one-light, one-dark-pro). */
export declare const createCodeHighlighter: (options?: CodeHighlighterOptions) => Promise<{
    highlight: (code: string, lang: string, meta: Meta, annotationPayload?: AnnotationPayload) => import("hast").Root;
}>;
export declare const langAlias: Record<string, string>;
/** The parts of a site the highlighter is built from: its themes and extra languages (`codeBlock.themes`, `codeBlock.languages`). */
export type HighlightSite = Pick<Site, "CODE_BLOCK_THEMES" | "EXTRA_CODE_LANGUAGES">;
/** Highlighter options of a site (`codeBlock.themes`, `codeBlock.languages` on top of the default list). */
export declare const siteCodeHighlighterOptions: (site: HighlightSite) => Promise<CodeHighlighterOptions>;
/**
 * The highlighter of a site: its themes and languages (`codeBlock`, else the reference defaults), created on first use and kept for that site. Two sites with
 * different themes in one process each get their own (they share Shiki's loaded themes and languages, not their settings).
 */
export declare const siteHighlight: (site: HighlightSite) => Promise<(code: string, lang: string, meta: Meta, annotationPayload?: AnnotationPayload) => import("hast").Root>;
