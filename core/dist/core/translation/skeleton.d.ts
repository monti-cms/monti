import type { BlockDefinition } from "../../blocks/define.js";
import { type StoredDocument } from "../../doc/stored-document.js";
import type { Site } from "../../site/index.js";
/** Human-readable attribute names of one block. */
export declare function readableAttributes(block: BlockDefinition, blockByName: ReadonlyMap<string, BlockDefinition>): Set<string>;
/**
 * Node/mark kind → human-readable attributes. The kind is the block name as stored (`callout`, `tooltip`, `image`) or `link` for a link mark.
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
/** The failure of a translated body that is not a document (`message`: why it could not be read, in the site's display language). */
export declare const unreadableFailure: (site: Pick<Site, "createTranslator">, message: string | undefined) => StructureCheck;
/** Whether the translated document has the same skeleton as the source document. Failure if either is not a document (an `unparsed` body). */
export declare function compareStructure(site: Pick<Site, "BLOCKS" | "createTranslator">, source: StoredDocument, translated: StoredDocument): StructureCheck;
