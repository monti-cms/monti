/** Code block rendering: annotations → shiki decorations → highlighted HTML (hast). Shared by the reference blog and other sites. */
export { fromCodeBlockDocumentToShikiAnnotationPayload } from "./annotation-payload.js";
export { createCodeHighlighter, langAlias, siteHighlight, } from "./code-highlighter.js";
export { DEFAULT_CODE_LANG_ALIAS, DEFAULT_CODE_LANGS, DEFAULT_CODE_THEMES } from "./default-code-options.js";
export { createAllowedRenderTagsFromConfig, isSafeRenderTag } from "./render-policy.js";
export { showsLineNumbers } from "./transformers.js";
