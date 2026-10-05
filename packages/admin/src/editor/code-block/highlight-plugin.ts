import {
	CODE_BLOCK_THEMES,
	type CodeBlockThemes,
	DEFAULT_CODE_BLOCK_THEMES,
	EXTRA_CODE_LANGUAGES,
} from "@monti-cms/core/code-block";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { BundledTheme, Highlighter } from "shiki";

export const codeBlockHighlightPluginKey = new PluginKey<{ version: number }>("cmsCodeBlockHighlight");

let highlighterPromise: Promise<Highlighter> | null = null;

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
export const highlighterOptions = (themes: CodeBlockThemes = CODE_BLOCK_THEMES) => ({
	themes: [...new Set([themes.light, themes.dark])],
	langs: BASE_LANGUAGES,
});

/** Themes the highlighter was created with: the site's, or the defaults when the site's names are not Shiki themes. */
let activeThemes: CodeBlockThemes = CODE_BLOCK_THEMES;

/** Loads the site's extra languages (`codeBlock.languages`). A name Shiki does not know is skipped (that code shows as plain text), never an error. */
export async function loadExtraLanguages(
	highlighter: Pick<Highlighter, "loadLanguage">,
	names: readonly string[] = EXTRA_CODE_LANGUAGES,
): Promise<string[]> {
	const loaded = await Promise.all(
		names.map((name) =>
			highlighter.loadLanguage(name as never).then(
				() => name,
				() => null,
			),
		),
	);
	return loaded.filter((name): name is string => name !== null);
}

export async function getShikiHighlighter(): Promise<Highlighter> {
	if (!highlighterPromise) {
		highlighterPromise = import("shiki").then(async ({ createHighlighter }) => {
			let highlighter: Highlighter;
			try {
				highlighter = await createHighlighter(highlighterOptions(CODE_BLOCK_THEMES));
				activeThemes = CODE_BLOCK_THEMES;
			} catch {
				// A theme name Shiki does not bundle must not break the editor: use the default themes.
				highlighter = await createHighlighter(highlighterOptions(DEFAULT_CODE_BLOCK_THEMES));
				activeThemes = DEFAULT_CODE_BLOCK_THEMES;
			}
			await loadExtraLanguages(highlighter);
			return highlighter;
		});
	}
	return highlighterPromise;
}

/** Tokens of `code` with the light and dark theme colors (the same pair the public page uses). */
export function tokensWithThemes(
	highlighter: Pick<Highlighter, "codeToTokensWithThemes">,
	lang: string,
	code: string,
	themes: CodeBlockThemes = activeThemes,
) {
	return highlighter.codeToTokensWithThemes(code, {
		lang: lang as Parameters<Highlighter["codeToTokensWithThemes"]>[1]["lang"],
		themes: { light: themes.light as BundledTheme, dark: themes.dark as BundledTheme },
	});
}

// Normalize language names
const LANG_MAP: Record<string, string> = {
	ts: "typescript",
	js: "javascript",
	py: "python",
	rs: "rust",
	cs: "csharp",
	sh: "bash",
	yml: "yaml",
};

function normalizeLang(lang: string | null | undefined): string {
	if (!lang) return "text";
	const lower = lang.toLowerCase().trim();
	return LANG_MAP[lower] ?? lower;
}

// Highlight token cache (lang:::code -> decoration factory based on relative offsets)
interface CachedToken {
	from: number;
	to: number;
	style: string;
}

const highlightCache = new Map<string, CachedToken[]>();
const MAX_HIGHLIGHT_CACHE_ENTRIES = 50;
const cacheHighlight = (key: string, tokens: CachedToken[]) => {
	highlightCache.delete(key);
	highlightCache.set(key, tokens);
	if (highlightCache.size > MAX_HIGHLIGHT_CACHE_ENTRIES) {
		const oldest = highlightCache.keys().next().value;
		if (oldest !== undefined) highlightCache.delete(oldest);
	}
};
const pendingRequests = new Set<string>();

async function requestHighlight(view: EditorView, lang: string, code: string, cacheKey: string) {
	if (pendingRequests.has(cacheKey) || highlightCache.has(cacheKey)) return;
	pendingRequests.add(cacheKey);

	try {
		const highlighter = await getShikiHighlighter();
		const normalized = normalizeLang(lang);

		if (normalized !== "text" && !highlighter.getLoadedLanguages().includes(normalized)) {
			try {
				await highlighter.loadLanguage(normalized as never);
			} catch {
				// Fall back to text for unsupported languages
			}
		}

		const resolvedLang = highlighter.getLoadedLanguages().includes(normalized) ? normalized : "text";

		if (resolvedLang === "text") {
			cacheHighlight(cacheKey, []);
			pendingRequests.delete(cacheKey);
			return;
		}

		const tokensByLine = tokensWithThemes(highlighter, resolvedLang, code);

		const tokens: CachedToken[] = [];

		for (const line of tokensByLine) {
			for (const token of line) {
				if (token.content.length === 0) continue;
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
	} catch {
		cacheHighlight(cacheKey, []);
	} finally {
		pendingRequests.delete(cacheKey);
		// If the view is still alive, trigger an update via transaction meta
		try {
			if (!view.isDestroyed) {
				view.dispatch(view.state.tr.setMeta(codeBlockHighlightPluginKey, { cacheKey }));
			}
		} catch {
			// view unmounted
		}
	}
}

export function createCodeBlockHighlightPlugin(): Plugin {
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
				const decorations: Decoration[] = [];
				const doc = state.doc;

				doc.descendants((node, pos) => {
					if (node.type.name !== "codeBlock") return;

					const text = node.textContent;
					const blockStart = pos + 1;
					const lang = (node.attrs.language as string) || "text";

					// Shiki syntax highlighting decorations
					if (text.length > 0 && lang !== "text") {
						const cacheKey = `${lang}:::${text}`;
						const cached = highlightCache.get(cacheKey);
						if (cached) {
							for (const token of cached) {
								if (token.to <= text.length) {
									decorations.push(
										Decoration.inline(blockStart + token.from, blockStart + token.to, {
											style: token.style,
											class: "shiki-token",
										}),
									);
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
						const lang = (node.attrs.language as string) || "text";
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
