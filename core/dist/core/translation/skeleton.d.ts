import type { BlockDefinition } from "../../blocks/define.js";
/** Human-readable attribute names of one block. */
export declare function readableAttributes(block: BlockDefinition, blockByName: ReadonlyMap<string, BlockDefinition>): Set<string>;
/**
 * Node/mark kind → human-readable attributes. For directive and JSX blocks the kind is the renderer name (`Callout`); for inline directive marks and
 * Markdown images it is the block name (`tooltip`, `image`).
 */
export declare function readableAttributesByType(blocks: readonly BlockDefinition[]): Map<string, ReadonlySet<string>>;
/** Failure reason codes of the structure check. The reason message is `reason`. */
export type StructureFailCode = "mdx_error" | "source_unreadable" | "structure_changed";
export type StructureCheck = {
    ok: true;
} | {
    ok: false;
    code: StructureFailCode /** Reason in the site's display language (`cms.translation` dictionary). */;
    reason: string;
};
/** Whether the translated MDX has the same skeleton as the source MDX. Failure if it cannot be read as MDX. */
export declare function compareStructure(sourceMdx: string, translatedMdx: string): StructureCheck;
/** Whether it can be read as MDX (even with the structure check off, it must be readable to go into the body). */
export declare function readableMdx(mdx: string): StructureCheck;
