import { defineBlock, z } from "@monti-cms/core";
import { Mermaid } from "./site";

/** A diagram (` ```mermaid `): Mermaid's source, drawn in the reader's browser (doc 18). */
export const mermaid = defineBlock({
	type: "mermaid",
	label: { ko: "다이어그램", en: "Diagram" },
	description:
		"A diagram in Mermaid's language (`source`): a flowchart, a sequence, a state or an entity diagram. It is drawn in the reader's browser.",
	menu: "insert",
	attrs: z.object({ source: z.string() }),
	fields: { source: { label: { ko: "다이어그램", en: "Diagram" } } },
	fence: { language: "mermaid", attr: "source" },
	holds: "nothing",
	Site: Mermaid,
});
