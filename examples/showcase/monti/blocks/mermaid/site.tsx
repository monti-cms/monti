import type { BlockProps } from "@monti-cms/core/render";
import { MermaidView } from "./mermaid.client";
import { style } from "./style";

/** A Mermaid diagram (` ```mermaid `): its source until the browser has drawn it (`MermaidView`). */
function MermaidDrawing({ attrs }: BlockProps) {
	const source = typeof attrs.source === "string" ? attrs.source : "";
	return source.trim() === "" ? null : <MermaidView source={source} />;
}

/** Mermaid with its look (`style.ts`): React puts it into the page once, however many of the block there are. */
export function Mermaid(props: Parameters<typeof MermaidDrawing>[0]) {
	return (
		<>
			<style href="monti-block-mermaid" precedence="monti-blocks">
				{style}
			</style>
			<MermaidDrawing {...props} />
		</>
	);
}
