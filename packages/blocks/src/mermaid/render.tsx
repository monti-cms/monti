import type { BlockProps, DocumentComponentsContext, LooseDocumentComponents } from "@monti-cms/core/render";
import type { mermaidBlock } from "./definition";
import { MermaidView } from "./render.client";

/** Rendering of the Mermaid block (` ```mermaid `). The code is the `source` attribute (`remarkFenceBlocksToMdx`). */
export function Mermaid({ source }: { source?: string }) {
	return <MermaidView source={source ?? ""} />;
}

/** Public components for Mermaid in the JSON renderer (`renderDocument`): the block `mermaid`. The code of the fence arrives as `source`. */
export const documentComponents = (_context: DocumentComponentsContext): LooseDocumentComponents => ({
	blocks: { mermaid: ({ source }: BlockProps<typeof mermaidBlock>) => <Mermaid source={source} /> },
});
