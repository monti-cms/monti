import type { Element, Root } from "hast";
import { toString as hastToString } from "hast-util-to-string";
import type { DecorationItem } from "shiki";
import { visit } from "unist-util-visit";
import {
	type CodeHighlighterOptions,
	createCodeHighlighter,
	highlight as defaultHighlight,
	type HighlightFn,
} from "./code-highlighter";
import type { LineDecorationPayload, LineWrapperPayload, Meta } from "./transformers";

export type RehypeShikiDecorationRenderOptions = CodeHighlighterOptions & {
	ignoreLang?: (lang: string) => boolean;
	/** 코드를 강조하는 함수. 주면 `langs`·`themes`·`langAlias`는 쓰지 않는다. */
	highlight?: HighlightFn;
};

/** 코드 강조 설정(언어·테마·별칭). 안 주면 블로그 기본값이다. */
export type CodeHighlightOptions = RehypeShikiDecorationRenderOptions;

const hasHighlighterOptions = (options: CodeHighlighterOptions) =>
	options.langs !== undefined || options.themes !== undefined || options.langAlias !== undefined;

function findCodeChild(pre: Element): Element | null {
	const child = pre.children?.find((c) => c?.type === "element" && c.tagName === "code");
	return (child as Element) ?? null;
}

function getLangFromCodeEl(codeEl: Element): string {
	const cn = codeEl.properties?.className;
	const classes = Array.isArray(cn) ? cn : cn ? [cn] : [];
	const lang = classes
		.map(String)
		.find((c) => c.startsWith("language-"))
		?.slice("language-".length);
	return lang || "text";
}

export function rehypeShikiDecorationRender(options: RehypeShikiDecorationRenderOptions = {}) {
	// 언어·테마를 바꾼 경우에만 강조기를 새로 만든다(한 번만). 아니면 기본 강조기를 그대로 쓴다.
	const customHighlight =
		options.highlight || !hasHighlighterOptions(options)
			? null
			: createCodeHighlighter(options).then((highlighter) => highlighter.highlight);

	return async (tree: Root) => {
		const highlight = options.highlight ?? (await customHighlight) ?? defaultHighlight;

		visit(tree, "element", (node, index, parent) => {
			if (!parent || index == null) return;
			if (node.tagName !== "pre") return;

			const pre = node as Element;
			const codeEl = findCodeChild(pre);
			if (!codeEl) return;

			let code = hastToString(codeEl);

			code = code.replace(/\r?\n$/, "");

			const lang = getLangFromCodeEl(codeEl);

			if (options.ignoreLang?.(lang)) return;

			const metaStr = (pre.properties?.["data-meta"] ?? codeEl.properties?.["data-meta"]) as string | undefined;

			const decoratonStr = (pre.properties?.["data-decorations"] ?? codeEl.properties?.["data-decorations"]) as
				| string
				| undefined;
			const lineDecorationStr = (pre.properties?.["data-line-decorations"] ??
				codeEl.properties?.["data-line-decorations"]) as string | undefined;
			const rowWrapperStr = (pre.properties?.["data-line-wrappers"] ?? codeEl.properties?.["data-line-wrappers"]) as
				| string
				| undefined;
			const renderTagsStr = (pre.properties?.["data-render-tags"] ?? codeEl.properties?.["data-render-tags"]) as
				| string
				| undefined;

			const meta: Meta = metaStr ? JSON.parse(metaStr) : {};
			const decorations: DecorationItem[] = decoratonStr ? JSON.parse(decoratonStr) : [];
			const lineDecorations: LineDecorationPayload[] = lineDecorationStr ? JSON.parse(lineDecorationStr) : [];
			const rowWrappers: LineWrapperPayload[] = rowWrapperStr ? JSON.parse(rowWrapperStr) : [];
			const allowedRenderTags: string[] = renderTagsStr ? JSON.parse(renderTagsStr) : [];

			const hast = highlight(code, lang, meta, {
				decorations,
				lineDecorations,
				rowWrappers,
				allowedRenderTags,
			});

			// codeToHast 결과는 Root(fragment). 보통 첫 element가 <pre>
			const newPre = hast.children.find((n) => n.type === "element") as Element;

			// 기존 <pre>를 새 <pre>로 교체
			parent.children[index] = newPre;
		});
	};
}
