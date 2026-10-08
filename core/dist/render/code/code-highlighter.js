import { transformerRenderIndentGuides } from "@shikijs/transformers";
import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import { bundledLanguages } from "shiki/langs";
import { bundledThemes } from "shiki/themes";
import { perSite } from "../../site/per-site.js";
import { DEFAULT_CODE_LANG_ALIAS, DEFAULT_CODE_LANGS, DEFAULT_CODE_THEMES } from "./default-code-options.js";
import { addLineDecorations, addLineNumbers, addLineWrappers, addMetaToPre, convertInlineAnnoToRenderTag, numberCodeNotes, showsLineNumbers, } from "./transformers.js";
const themeName = (theme) => (theme.name ?? "");
/** Creates a code block highlighter with the languages and themes given by options. Without options, it uses the reference defaults (one-light, one-dark-pro). */
export const createCodeHighlighter = async (options = {}) => {
    const themes = options.themes ?? DEFAULT_CODE_THEMES;
    const highlighter = await createHighlighterCore({
        themes: [themes.light, themes.dark],
        langs: options.langs ?? DEFAULT_CODE_LANGS,
        langAlias: options.langAlias ?? DEFAULT_CODE_LANG_ALIAS,
        engine: await createOnigurumaEngine(import("shiki/wasm")),
    });
    /** A language that is not loaded is shown as plain text: one unknown fence language must not fail the whole page. */
    const loadedLang = (lang) => {
        try {
            highlighter.getLanguage(lang);
            return lang;
        }
        catch {
            return "text";
        }
    };
    const highlight = (code, lang, meta, annotationPayload = {}) => {
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
const loadTheme = async (key, name) => {
    const fallback = DEFAULT_CODE_THEMES[key];
    if (name === themeName(fallback))
        return fallback;
    const load = bundledThemes[name];
    if (!load)
        throw new Error(`cms.config: codeBlock.themes.${key}: "${name}" is not a Shiki theme`);
    return (await load()).default;
};
const loadLanguage = async (name) => {
    const load = bundledLanguages[name];
    if (!load)
        throw new Error(`cms.config: codeBlock.languages.${name}: "${name}" is not a Shiki language`);
    return (await load()).default;
};
/** Highlighter options of a site (`codeBlock.themes`, `codeBlock.languages` on top of the default list). */
export const siteCodeHighlighterOptions = async (site) => ({
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
export const siteHighlight = perSite(async (site) => (await createCodeHighlighter(await siteCodeHighlighterOptions(site))).highlight);
