import type { DocumentComponentsContext, LooseDocumentComponents } from "@monti-cms/core/render";
/** Rendering of the Mermaid block (` ```mermaid `). The code is the `source` attribute (`remarkFenceBlocksToMdx`). */
export declare function Mermaid({ source }: {
    source?: string;
}): import("react").JSX.Element;
/** Public components for Mermaid in the JSON renderer (`renderDocument`): the block `mermaid`. The code of the fence arrives as `source`. */
export declare const documentComponents: (_context: DocumentComponentsContext) => LooseDocumentComponents;
