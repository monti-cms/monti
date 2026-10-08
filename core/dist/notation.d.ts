/**
 * Helpers for text notations (`@monti-cms/core/notation`): what a format or a syntax extension needs to read and write a document as text, without the site config.
 *
 * Like the authoring API (`@monti-cms/core`), modules exported here take what they need as arguments and import no `Site`, no instance and no server code: an
 * extension package imports this entry point from the site config file, which runs before any site exists.
 */
/** The comment syntax of a code fence language and the annotation comment Monti writes in it (`// @line plus`), for notations that read or write code comments. */
export { type CommentSyntax, formatAnnotationComment, resolveCommentSyntax, } from "./annotation/code-block/comment-syntax.js";
/** Table layout (merged cells, column widths, headers) for notations that write tables a Markdown table cannot express. */
export { formatTableWidths, hasBalancedLabelBrackets, hasNonGfmHeaderLayout, parseTableWidths, tableHasMergedCells, tableWidths, } from "./doc/table-layout.js";
