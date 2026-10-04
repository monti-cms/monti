/** Code block rendering: annotations → shiki decorations (remark) → highlighted HTML (rehype). Shared by the reference blog and other sites. */
export { type AnnotationPayload, CODE_BLOCK_THEME_DARK, CODE_BLOCK_THEME_LIGHT, type CodeHighlighter, type CodeHighlighterOptions, createCodeHighlighter, type HighlightFn, highlight, langAlias, } from "./code-highlighter.js";
export { DEFAULT_CODE_LANG_ALIAS, DEFAULT_CODE_LANGS, DEFAULT_CODE_THEMES } from "./default-code-options.js";
export { type CodeHighlightOptions, type RehypeShikiDecorationRenderOptions, rehypeShikiDecorationRender, } from "./rehype-shiki-decoration-render.js";
export { fromCodeBlockDocumentToShikiAnnotationPayload, remarkAnnotationToShikiDecoration, type ShikiAnnotationPayload, } from "./remark-annotation-to-decoration.js";
export { createAllowedRenderTagsFromConfig, isSafeRenderTag } from "./render-policy.js";
export { type LineDecorationPayload, type LineWrapperPayload, type Meta, showsLineNumbers } from "./transformers.js";
