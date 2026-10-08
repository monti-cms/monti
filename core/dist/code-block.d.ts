/** Model for code block annotations (highlight and fold rules). Shared by the editor and the public renderer. */
export type { SiteCodeBlock } from "./annotation/code-block/active.js";
export { fromCodeFenceToCodeBlockDocument, parseCodeFenceMeta } from "./annotation/code-block/code-fence-to-document.js";
export { type CommentSyntax, formatAnnotationComment, resolveCommentSyntax, } from "./annotation/code-block/comment-syntax.js";
export * from "./annotation/code-block/constants.js";
export { fromCodeBlockDocumentToCodeFence } from "./annotation/code-block/document-to-code-fence.js";
export { createAnnotationRegistry, supportsAnnotationScope } from "./annotation/code-block/libs.js";
export * from "./annotation/code-block/line-effects.js";
export * from "./annotation/code-block/model.js";
export * from "./annotation/code-block/types.js";
