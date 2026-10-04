/** 코드 블록 렌더링: 주석 → shiki 장식(remark) → 강조된 HTML(rehype). 블로그와 다른 사이트가 함께 쓴다. */

export {
	type AnnotationPayload,
	CODE_BLOCK_THEME_DARK,
	CODE_BLOCK_THEME_LIGHT,
	type CodeHighlighter,
	type CodeHighlighterOptions,
	createCodeHighlighter,
	type HighlightFn,
	highlight,
	langAlias,
} from "./code-highlighter";
export { DEFAULT_CODE_LANG_ALIAS, DEFAULT_CODE_LANGS, DEFAULT_CODE_THEMES } from "./default-code-options";
export {
	type CodeHighlightOptions,
	type RehypeShikiDecorationRenderOptions,
	rehypeShikiDecorationRender,
} from "./rehype-shiki-decoration-render";
export {
	fromCodeBlockDocumentToShikiAnnotationPayload,
	remarkAnnotationToShikiDecoration,
	type ShikiAnnotationPayload,
} from "./remark-annotation-to-decoration";
export { createAllowedRenderTagsFromConfig, isSafeRenderTag } from "./render-policy";
export { type LineDecorationPayload, type LineWrapperPayload, type Meta, showsLineNumbers } from "./transformers";
