import { WorkflowAutomation } from "@monti-cms/admin/icons";
import { defineBlock, z } from "@monti-cms/core";
import { lazy } from "react";
import { Mermaid } from "./site";
import { words } from "./words";

/** A diagram (` ```mermaid `): Mermaid's source, drawn in the reader's browser (doc 18). */
export const mermaid = defineBlock({
	type: "mermaid",
	label: words.mermaid,
	description:
		"A diagram in Mermaid's language (`source`): a flowchart, a sequence, a state or an entity diagram. It is drawn in the reader's browser.",
	menu: "insert",
	attrs: z.object({ source: z.string() }),
	fields: { source: { label: { ko: "다이어그램", en: "Diagram" } } },
	fence: { language: "mermaid", attr: "source" },
	holds: "nothing",
	Site: Mermaid,
	// The editor's view (its own tool row and settings), loaded in the admin the first time it is drawn.
	Editor: lazy(() => import("./editor")),
	Icon: WorkflowAutomation,
	starter: () => ({ attrs: { source: "graph TD\n  A --> B" } }),
});
