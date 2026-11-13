"use client";

import { SourceBlock, useBlock } from "@monti-cms/admin/blocks";
import { useState } from "react";
import { MermaidView } from "./mermaid.client";
import { style } from "./style";
import { words } from "./words";

/**
 * A diagram in the editor (doc 18, the old block's): its drawing in a box; picked, its Mermaid source in a field of its own under the drawing. A source
 * that does not read keeps the last drawing and says why under the field.
 */
export default function MermaidEditor() {
	const block = useBlock();
	const say = (label: { ko: string; en: string }) => label[block.language];
	const source = typeof block.attrs.source === "string" ? block.attrs.source : "";
	const [error, setError] = useState<string | null>(null);
	return (
		<>
			<style href="monti-block-mermaid" precedence="monti-blocks">
				{style}
			</style>
			<SourceBlock
				label={say(words.source)}
				tools={say(words.tools)}
				source={source}
				empty={say(words.empty)}
				placeholder={say(words.placeholder)}
				errors={error ? [error] : []}
				onChange={(next) => block.setAttrs({ source: next })}
			>
				<MermaidView source={source} onError={setError} />
			</SourceBlock>
		</>
	);
}
