/**
 * The syntax extension API of `@monti-cms/mdx`.
 *
 * Stored MDX is CommonMark + GFM + standard MDX JSX. A site opts into extra notations with `mdx({ syntax: [...] })`. An extension package
 * (`@monti-cms/syntax-directive`, `@monti-cms/syntax-shiki`) imports everything it needs from here.
 *
 * It has no remark imports of its own (only types), so the site config can import it.
 *
 * @experimental This entry point may change in a minor release.
 */
export type { BlockDefinition } from "@monti-cms/core/client";
export type { CmsMark, CmsNode } from "@monti-cms/core/document";
/** The comment syntax of a code fence language and the annotation comment Monti writes in it (`// @line plus`), for extensions that read or write code comments. */
export { type CommentSyntax, formatAnnotationComment, resolveCommentSyntax, } from "@monti-cms/core/notation";
export { RAW_SOURCE_PARAGRAPH } from "./raw-source.js";
export { formatTableWidths, hasBalancedLabelBrackets, hasNonGfmHeaderLayout, tableHasMergedCells, tableWidths, } from "./table.js";
export type { SerializeContext, SerializeInlinesOptions, SyntaxBlocks, SyntaxContext, SyntaxExtension, SyntaxMarkWriter, SyntaxNodeWriter, } from "./types.js";
