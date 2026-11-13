"use client";

import { SourceBlock, useBlock } from "@monti-cms/admin/blocks";
import { normalizeChartDsl, parseChartDsl } from "./dsl";
import { Chart } from "./site";
import { errorLine, words } from "./words";

/**
 * A chart in the editor (doc 18, the old block's): the drawing the site makes, and, picked, its text in a field of its own under it, each line that does
 * not read said under the field.
 */
export default function ChartEditor() {
	const block = useBlock();
	const say = (label: { ko: string; en: string }) => label[block.language];
	const source = typeof block.attrs.source === "string" ? block.attrs.source : "";
	const { errors } = normalizeChartDsl(parseChartDsl(source));
	return (
		<SourceBlock
			label={say(words.source)}
			tools={say(words.tools)}
			source={source}
			empty={say(words.empty)}
			placeholder={say(words.placeholder)}
			errors={source.trim() === "" ? [] : errors.map((error) => errorLine(error, block.language))}
			onChange={(next) => block.setAttrs({ source: next })}
		>
			<Chart block={{ id: "", type: "chart", attrs: { source } }} attrs={{ source }} />
		</SourceBlock>
	);
}
