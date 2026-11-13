"use client";

import { SourceBlock, useBlock } from "@monti-cms/admin/blocks";
import { drawFormula } from "./site";
import { style } from "./style";
import { words } from "./words";

/**
 * A formula in the editor (doc 18, the old block's): its drawing in a box; picked, its LaTeX in a field of its own under the drawing, written 0.4s after
 * typing stops. A formula that does not read leaves the drawing empty and says why under the field.
 */
export default function MathEditor() {
	const block = useBlock();
	const say = (label: { ko: string; en: string }) => label[block.language];
	const source = typeof block.attrs.source === "string" ? block.attrs.source : "";
	const drawn = source.trim() === "" ? null : drawFormula(source);
	return (
		<>
			<style href="monti-block-math" precedence="monti-blocks">
				{style}
			</style>
			<SourceBlock
				label={say(words.source)}
				tools={say(words.tools)}
				source={source}
				empty={say(words.empty)}
				placeholder={say(words.placeholder)}
				errors={drawn && "error" in drawn ? [drawn.error] : []}
				onChange={(next) => block.setAttrs({ source: next })}
			>
				{drawn && "html" in drawn ? (
					// biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX's own markup, made from the formula with no HTML of the writer's in it.
					<div className="monti-block-math" dangerouslySetInnerHTML={{ __html: drawn.html }} />
				) : null}
			</SourceBlock>
		</>
	);
}
