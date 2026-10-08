import { type Site } from "@monti-cms/core/client";
import { type CodeBlockThemes } from "@monti-cms/core/code-block";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Highlighter } from "shiki";
export declare const codeBlockHighlightPluginKey: PluginKey<{
    version: number;
}>;
/** Options to create the highlighter with the site's themes (`codeBlock.themes`). */
export declare const highlighterOptions: (themes: CodeBlockThemes) => {
    themes: string[];
    langs: string[];
};
/** Loads the site's extra languages (`codeBlock.languages`). A name Shiki does not know is skipped (that code shows as plain text), never an error. */
export declare function loadExtraLanguages(highlighter: Pick<Highlighter, "loadLanguage">, names: readonly string[]): Promise<string[]>;
export declare function getShikiHighlighter(site: Pick<Site, "CODE_BLOCK_THEMES" | "EXTRA_CODE_LANGUAGES">): Promise<Highlighter>;
/** Tokens of `code` with the light and dark theme colors (the same pair the public page uses). */
export declare function tokensWithThemes(highlighter: Pick<Highlighter, "codeToTokensWithThemes">, lang: string, code: string, themes: CodeBlockThemes): import("shiki").ThemedTokenWithVariants[][];
export declare function createCodeBlockHighlightPlugin(site: Pick<Site, "CODE_BLOCK_THEMES" | "EXTRA_CODE_LANGUAGES">): Plugin;
