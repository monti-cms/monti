/**
 * Helpers for text notations (`@monti-cms/core/notation`): what a format or a syntax extension needs to read and write a document as text, without the site config.
 *
 * Like the authoring API (`@monti-cms/core`), modules exported here must not import the site config (`config/resolved.ts`): an extension package imports this
 * entry point from the site config file, so that would create a cycle and the config would be read half-built.
 */

/** The comment syntax of a code fence language and the annotation comment Monti writes in it (`// @line plus`), for notations that read or write code comments. */
export {
	type CommentSyntax,
	formatAnnotationComment,
	resolveCommentSyntax,
} from "./annotation/code-block/comment-syntax";
/** Table layout (merged cells, column widths, headers) for notations that write tables a Markdown table cannot express. */
export {
	formatTableWidths,
	hasBalancedLabelBrackets,
	hasNonGfmHeaderLayout,
	parseTableWidths,
	tableHasMergedCells,
	tableWidths,
} from "./doc/table-layout";
