import { perSite } from "@monti-cms/core/client";
import { DEFAULT_CODE_BLOCK_THEMES } from "@monti-cms/core/code-block";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
export const codeBlockHighlightPluginKey = new PluginKey("cmsCodeBlockHighlight");
/** Languages loaded when the highlighter is created. Others load on demand when a block uses them. */
const BASE_LANGUAGES = [
    "typescript",
    "javascript",
    "tsx",
    "jsx",
    "json",
    "python",
    "rust",
    "go",
    "java",
    "kotlin",
    "cpp",
    "csharp",
    "swift",
    "html",
    "css",
    "scss",
    "postcss",
    "sql",
    "bash",
    "yaml",
    "toml",
    "markdown",
    "mdx",
    "docker",
    "graphql",
];
/** Options to create the highlighter with the site's themes (`codeBlock.themes`). */
export const highlighterOptions = (themes) => ({
    themes: [...new Set([themes.light, themes.dark])],
    langs: BASE_LANGUAGES,
});
const stateOf = perSite((site) => ({
    highlighterPromise: null,
    activeThemes: site.CODE_BLOCK_THEMES,
    cache: new Map(),
    pending: new Set(),
}));
/** Loads the site's extra languages (`codeBlock.languages`). A name Shiki does not know is skipped (that code shows as plain text), never an error. */
export async function loadExtraLanguages(highlighter, names) {
    const loaded = await Promise.all(names.map((name) => highlighter.loadLanguage(name).then(() => name, () => null)));
    return loaded.filter((name) => name !== null);
}
export async function getShikiHighlighter(site) {
    const state = stateOf(site);
    if (!state.highlighterPromise) {
        state.highlighterPromise = import("shiki").then(async ({ createHighlighter }) => {
            let highlighter;
            try {
                highlighter = await createHighlighter(highlighterOptions(site.CODE_BLOCK_THEMES));
                state.activeThemes = site.CODE_BLOCK_THEMES;
            }
            catch {
                // A theme name Shiki does not bundle must not break the editor: use the default themes.
                highlighter = await createHighlighter(highlighterOptions(DEFAULT_CODE_BLOCK_THEMES));
                state.activeThemes = DEFAULT_CODE_BLOCK_THEMES;
            }
            await loadExtraLanguages(highlighter, site.EXTRA_CODE_LANGUAGES);
            return highlighter;
        });
    }
    return state.highlighterPromise;
}
/** Tokens of `code` with the light and dark theme colors (the same pair the public page uses). */
export function tokensWithThemes(highlighter, lang, code, themes) {
    return highlighter.codeToTokensWithThemes(code, {
        lang: lang,
        themes: { light: themes.light, dark: themes.dark },
    });
}
// Normalize language names
const LANG_MAP = {
    ts: "typescript",
    js: "javascript",
    py: "python",
    rs: "rust",
    cs: "csharp",
    sh: "bash",
    yml: "yaml",
};
function normalizeLang(lang) {
    if (!lang)
        return "text";
    const lower = lang.toLowerCase().trim();
    return LANG_MAP[lower] ?? lower;
}
const MAX_HIGHLIGHT_CACHE_ENTRIES = 50;
const cacheHighlight = (cache, key, tokens) => {
    cache.delete(key);
    cache.set(key, tokens);
    if (cache.size > MAX_HIGHLIGHT_CACHE_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined)
            cache.delete(oldest);
    }
};
async function requestHighlight(site, view, lang, code, cacheKey) {
    const { cache: highlightCache, pending: pendingRequests } = stateOf(site);
    if (pendingRequests.has(cacheKey) || highlightCache.has(cacheKey))
        return;
    pendingRequests.add(cacheKey);
    try {
        const highlighter = await getShikiHighlighter(site);
        const normalized = normalizeLang(lang);
        if (normalized !== "text" && !highlighter.getLoadedLanguages().includes(normalized)) {
            try {
                await highlighter.loadLanguage(normalized);
            }
            catch {
                // Fall back to text for unsupported languages
            }
        }
        const resolvedLang = highlighter.getLoadedLanguages().includes(normalized) ? normalized : "text";
        if (resolvedLang === "text") {
            cacheHighlight(highlightCache, cacheKey, []);
            pendingRequests.delete(cacheKey);
            return;
        }
        const tokensByLine = tokensWithThemes(highlighter, resolvedLang, code, stateOf(site).activeThemes);
        const tokens = [];
        for (const line of tokensByLine) {
            for (const token of line) {
                if (token.content.length === 0)
                    continue;
                const lightColor = token.variants?.light?.color;
                const darkColor = token.variants?.dark?.color;
                const style = [
                    lightColor ? `--shiki-light: ${lightColor}; color: var(--shiki-light);` : "",
                    darkColor ? `--shiki-dark: ${darkColor};` : "",
                ]
                    .filter(Boolean)
                    .join(" ");
                tokens.push({
                    from: token.offset,
                    to: token.offset + token.content.length,
                    style,
                });
            }
        }
        cacheHighlight(highlightCache, cacheKey, tokens);
    }
    catch {
        cacheHighlight(highlightCache, cacheKey, []);
    }
    finally {
        pendingRequests.delete(cacheKey);
        // If the view is still alive, trigger an update via transaction meta
        try {
            if (!view.isDestroyed) {
                view.dispatch(view.state.tr.setMeta(codeBlockHighlightPluginKey, { cacheKey }));
            }
        }
        catch {
            // view unmounted
        }
    }
}
export function createCodeBlockHighlightPlugin(site) {
    const { cache: highlightCache } = stateOf(site);
    return new Plugin({
        key: codeBlockHighlightPluginKey,
        state: {
            init() {
                return { version: 0 };
            },
            apply(tr, prev) {
                const meta = tr.getMeta(codeBlockHighlightPluginKey);
                if (meta) {
                    return { version: prev.version + 1 };
                }
                return prev;
            },
        },
        props: {
            decorations(state) {
                const decorations = [];
                const doc = state.doc;
                doc.descendants((node, pos) => {
                    if (node.type.name !== "codeBlock")
                        return;
                    const text = node.textContent;
                    const blockStart = pos + 1;
                    const lang = node.attrs.language || "text";
                    // Shiki syntax highlighting decorations
                    if (text.length > 0 && lang !== "text") {
                        const cacheKey = `${lang}:::${text}`;
                        const cached = highlightCache.get(cacheKey);
                        if (cached) {
                            for (const token of cached) {
                                if (token.to <= text.length) {
                                    decorations.push(Decoration.inline(blockStart + token.from, blockStart + token.to, {
                                        style: token.style,
                                        class: "shiki-token",
                                    }));
                                }
                            }
                        }
                    }
                });
                return DecorationSet.create(doc, decorations);
            },
        },
        view(editorView) {
            // On initial load, request highlighting for code blocks visible in the view
            const requestVisibleBlocks = () => {
                const state = editorView.state;
                state.doc.descendants((node, _pos) => {
                    if (node.type.name === "codeBlock" && node.textContent.length > 0) {
                        const lang = node.attrs.language || "text";
                        const cacheKey = `${lang}:::${node.textContent}`;
                        if (!highlightCache.has(cacheKey)) {
                            requestHighlight(site, editorView, lang, node.textContent, cacheKey);
                        }
                    }
                });
            };
            requestVisibleBlocks();
            return {
                update() {
                    requestVisibleBlocks();
                },
            };
        },
    });
}
