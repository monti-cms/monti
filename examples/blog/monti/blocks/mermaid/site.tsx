import type { BlockProps } from "@monti-cms/core/render";
import { MermaidView } from "./mermaid.client";

/** A Mermaid diagram (` ```mermaid `): its source until the browser has drawn it (`MermaidView`). */
export function Mermaid({ attrs }: BlockProps) {
	const source = typeof attrs.source === "string" ? attrs.source : "";
	return source.trim() === "" ? null : <MermaidView source={source} />;
}
