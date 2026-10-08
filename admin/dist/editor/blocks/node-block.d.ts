import { type BlockDefinition, type Site } from "@monti-cms/core/client";
/** The block definition an editor node renders: a core block with its own view, or an added block (block extension or site config). */
export declare const blockOfNode: (site: Pick<Site, "ADDED_BLOCKS">, nodeName: string) => BlockDefinition | undefined;
