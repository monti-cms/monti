/** Code block rendering: annotations → shiki decorations → highlighted HTML (hast). Shared by the reference blog and other sites. */

export { fromCodeBlockDocumentToShikiAnnotationPayload, type ShikiAnnotationPayload } from "./annotation-payload";
export {
	type AnnotationPayload,
	CODE_BLOCK_THEME_DARK,
	CODE_BLOCK_THEME_LIGHT,
	type CodeHighlighter,
	type CodeHighlighterOptions,
	type CodeHighlightOptions,
	createCodeHighlighter,
	type HighlightFn,
	highlight,
	langAlias,
} from "./code-highlighter";
export { DEFAULT_CODE_LANG_ALIAS, DEFAULT_CODE_LANGS, DEFAULT_CODE_THEMES } from "./default-code-options";
export { createAllowedRenderTagsFromConfig, isSafeRenderTag } from "./render-policy";
export { type LineDecorationPayload, type LineWrapperPayload, type Meta, showsLineNumbers } from "./transformers";
