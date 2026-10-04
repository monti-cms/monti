import type { CmsNode } from "@monti-cms/core/mdx";
import type { JSONContent } from "@tiptap/core";
/** Functions the converter uses for recursive and inline conversion. Passed in by `tiptap-content.ts`. */
export interface ConverterContext {
    blockToTiptap(node: CmsNode): JSONContent;
    tiptapBlockToCms(node: JSONContent): CmsNode[];
    isMappableBlock(node: CmsNode): boolean;
    isMappableInline(node: CmsNode): boolean;
    inlineToTiptap(nodes: CmsNode[]): JSONContent[];
    inlineToCms(nodes: JSONContent[] | undefined): CmsNode[];
}
/**
 * CmsNode to Tiptap conversion for a single block (and back).
 *
 * To attach an editing UI for a new block, build a module in this shape and add one line to `BLOCK_CONVERTERS` in `converters/index.ts`.
 * If `isMappable` is false, the block goes to the raw-source-preserving box (`cmsOpaqueBlock`).
 */
export interface BlockConverter {
    readonly name: string;
    /** The CmsNode `type` this converter accepts. */
    readonly cmsTypes: readonly string[];
    /** The Tiptap node name this converter accepts. */
    readonly tiptapTypes: readonly string[];
    /** Used to pick out a specific node among candidates with the same cmsType (e.g. a codeBlock whose language is mermaid or chart). */
    matches?(node: CmsNode): boolean;
    isMappable(node: CmsNode, ctx: ConverterContext): boolean;
    toTiptap(node: CmsNode, ctx: ConverterContext): JSONContent;
    toCms(node: JSONContent, ctx: ConverterContext): CmsNode[];
}
