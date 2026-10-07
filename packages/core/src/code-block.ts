/** Model for code block annotations (highlight and fold rules). Shared by the editor and the public renderer. */

export type { SiteCodeBlock } from "./annotation/code-block/active";
export { fromCodeFenceToCodeBlockDocument, parseCodeFenceMeta } from "./annotation/code-block/code-fence-to-document";
export {
	type CommentSyntax,
	formatAnnotationComment,
	resolveCommentSyntax,
} from "./annotation/code-block/comment-syntax";
export * from "./annotation/code-block/constants";
export { fromCodeBlockDocumentToCodeFence } from "./annotation/code-block/document-to-code-fence";
export { createAnnotationRegistry, supportsAnnotationScope } from "./annotation/code-block/libs";
export * from "./annotation/code-block/line-effects";
export * from "./annotation/code-block/model";
export * from "./annotation/code-block/types";
