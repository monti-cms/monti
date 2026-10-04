import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
export const codeBlockHighlightPluginKey = new PluginKey("cmsCodeBlockHighlight");
let highlighterPromise = null;
export async function getShikiHighlighter() {
    if (!highlighterPromise) {
        highlighterPromise = import("shiki").then(({ createHighlighter }) => createHighlighter({
            themes: ["one-light", "one-dark-pro"],
            langs: [
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
            ],
        }));
    }
    return highlighterPromise;
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
const highlightCache = new Map();
const MAX_HIGHLIGHT_CACHE_ENTRIES = 50;
const cacheHighlight = (key, tokens) => {
    highlightCache.delete(key);
    highlightCache.set(key, tokens);
    if (highlightCache.size > MAX_HIGHLIGHT_CACHE_ENTRIES) {
        const oldest = highlightCache.keys().next().value;
        if (oldest !== undefined)
            highlightCache.delete(oldest);
    }
};
const pendingRequests = new Set();
async function requestHighlight(view, lang, code, cacheKey) {
    if (pendingRequests.has(cacheKey) || highlightCache.has(cacheKey))
        return;
    pendingRequests.add(cacheKey);
    try {
        const highlighter = await getShikiHighlighter();
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
            cacheHighlight(cacheKey, []);
            pendingRequests.delete(cacheKey);
            return;
        }
        const tokensByLine = highlighter.codeToTokensWithThemes(code, {
            lang: resolvedLang,
            themes: {
                light: "one-light",
                dark: "one-dark-pro",
            },
        });
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
        cacheHighlight(cacheKey, tokens);
    }
    catch {
        cacheHighlight(cacheKey, []);
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
export function createCodeBlockHighlightPlugin() {
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
                            requestHighlight(editorView, lang, node.textContent, cacheKey);
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
