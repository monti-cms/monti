import { MermaidView } from "./render.client";

/** Rendering of the Mermaid block (` ```mermaid `). The code is the `source` attribute (`remarkFenceBlocksToMdx`). */
export function Mermaid({ source }: { source?: string }) {
	return <MermaidView source={source ?? ""} />;
}

/** Public component for Mermaid (called by `@monti-cms/core/render`). The diagram is drawn in the browser (optional dependency `mermaid`). */
export default () => ({ Mermaid });
