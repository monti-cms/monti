/**
 * Syntax extensions (`@monti-cms/core/syntax`).
 *
 * Stored MDX is CommonMark + GFM + standard MDX JSX. A site opts into extra notations with `defineConfig({ mdx: { syntax: [...] } })`.
 *
 * @experimental This entry point may change in a minor release.
 */

export type { BlockDefinition } from "../blocks/define";
export type { CmsMark, CmsNode } from "../mdx/types";
export { type DirectiveSyntaxOptions, directiveSyntax } from "./directive";
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
