import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { Highlighter } from "shiki";

export const codeBlockHighlightPluginKey = new PluginKey<{ version: number }>("cmsCodeBlockHighlight");

let highlighterPromise: Promise<Highlighter> | null = null;

export async function getShikiHighlighter(): Promise<Highlighter> {
	if (!highlighterPromise) {
		highlighterPromise = import("shiki").then(({ createHighlighter }) =>
			createHighlighter({
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
			}),
		);
	}
	return highlighterPromise;
}

// 언어 이름 정규화
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

// 하이라이팅 토큰 캐시 (lang:::code -> 상대 오프셋 기준 데코레이션 팩토리)
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
				// 지원하지 않는 언어면 text로 fallback
			}
		}

		const resolvedLang = highlighter.getLoadedLanguages().includes(normalized) ? normalized : "text";

		if (resolvedLang === "text") {
			cacheHighlight(cacheKey, []);
			pendingRequests.delete(cacheKey);
			return;
		}

		const tokensByLine = highlighter.codeToTokensWithThemes(code, {
			lang: resolvedLang as Parameters<typeof highlighter.codeToTokensWithThemes>[1]["lang"],
			themes: {
				light: "one-light",
				dark: "one-dark-pro",
			},
		});

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
		// 뷰가 아직 살아있다면 트랜잭션 메타로 갱신 트리거
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

					// Shiki 구문 하이라이팅 데코레이션
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
			// 초기 로드 시 뷰에 보이는 코드블록 하이라이팅 요청
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
