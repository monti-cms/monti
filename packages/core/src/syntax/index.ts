/**
 * Syntax extensions (`@monti-cms/core/syntax`).
 *
 * Stored MDX is CommonMark + GFM + standard MDX JSX. A site opts into extra notations with `defineConfig({ mdx: { syntax: [...] } })`.
 *
 * @experimental This entry point may change in a minor release.
 */

/** The comment syntax of a code fence language and the annotation comment Monti writes in it (`// @line plus`), for extensions that read or write code comments. */
export {
	type CommentSyntax,
	formatAnnotationComment,
	resolveCommentSyntax,
} from "../annotation/code-block/comment-syntax";
export type { BlockDefinition } from "../blocks/define";
export type { CmsMark, CmsNode } from "../mdx/types";
export { RAW_SOURCE_PARAGRAPH } from "./raw-source";
export {
	formatTableWidths,
	hasBalancedLabelBrackets,
	hasNonGfmHeaderLayout,
	tableHasMergedCells,
	tableWidths,
} from "./table";
export type {
	SerializeContext,
	SerializeInlinesOptions,
	SyntaxBlocks,
	SyntaxContext,
	SyntaxExtension,
	SyntaxMarkWriter,
	SyntaxNodeWriter,
} from "./types";
