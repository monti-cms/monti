import { transformerRenderIndentGuides } from "@shikijs/transformers";
import { getSingletonHighlighterCore, } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import { DEFAULT_CODE_LANG_ALIAS, DEFAULT_CODE_LANGS, DEFAULT_CODE_THEMES } from "./default-code-options.js";
import { addLineDecorations, addLineNumbers, addLineWrappers, addMetaToPre, convertInlineAnnoToRenderTag, numberCodeNotes, showsLineNumbers, } from "./transformers.js";
export const CODE_BLOCK_THEME_DARK = DEFAULT_CODE_THEMES.dark.name;
export const CODE_BLOCK_THEME_LIGHT = DEFAULT_CODE_THEMES.light.name;
const themeName = (theme) => (theme.name ?? "");
/** Creates a code block highlighter with the languages and themes given by options. Without options, it uses the reference defaults (one-light, one-dark-pro). */
export const createCodeHighlighter = async (options = {}) => {
    const themes = options.themes ?? DEFAULT_CODE_THEMES;
    const highlighter = await getSingletonHighlighterCore({
        themes: [themes.light, themes.dark],
        langs: options.langs ?? DEFAULT_CODE_LANGS,
        langAlias: options.langAlias ?? DEFAULT_CODE_LANG_ALIAS,
        engine: await createOnigurumaEngine(import("shiki/wasm")),
    });
    const highlight = (code, lang, meta, annotationPayload = {}) => {
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
