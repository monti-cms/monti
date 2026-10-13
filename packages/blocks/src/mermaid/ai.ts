import type { AiContribution } from "@monti-cms/core/ai-contract";
import { type AiTextSite, type DiagramAiText, diagramAi } from "../shared/diagram-ai";
import { mermaidMessages } from "./messages";

export type { AiTextSite } from "../shared/diagram-ai";

/**
 * AI features of the Mermaid block (only for sites using `@monti-cms/ai`). The `mermaid()` plugin adds them via `contributes.ai`, so they attach automatically
 * on sites that use the AI plugin (`diagramDraft`, `diagramEdit`). To change the instructions, write an entry with the same name; to turn one off, give `false`.
 * The contract types come from `@monti-cms/core/ai-contract`, so this block never depends on the AI plugin.
 *
 * ```ts
 * ai({ actions: { diagramDraft: mermaidAi.draft({ prompt: "…" }), diagramEdit: false } })
 * ```
 *
 * The actions are factories (`AiActionFactory`): the AI plugin calls them with the site, so the text is in that site's admin language.
 */

const textOf = (site: AiTextSite) => site.createTranslator(mermaidMessages);

/** Diagram types Mermaid knows (the first word of the first line). */
const DIAGRAM_TYPES = new Set([
	"graph",
	"flowchart",
	"sequenceDiagram",
	"classDiagram",
	"stateDiagram",
	"stateDiagram-v2",
	"erDiagram",
	"journey",
	"gantt",
	"pie",
	"quadrantChart",
	"requirementDiagram",
	"gitGraph",
	"C4Context",
	"C4Container",
	"C4Component",
	"C4Dynamic",
	"C4Deployment",
	"mindmap",
	"timeline",
	"sankey-beta",
	"xychart-beta",
	"block-beta",
	"packet-beta",
	"architecture-beta",
	"kanban",
]);

/**
 * Code validation: is the answer a single ```mermaid code fence whose first line is a diagram type Mermaid knows?
 * Actually rendering the diagram is checked by the browser (the preview).
 */
export function validateMermaid(site: AiTextSite, value: string): string | undefined {
	const t = textOf(site);
	const match = value.trim().match(/^```mermaid[^\n]*\n([\s\S]*?)\n?```$/);
	if (!match) return t("ai.error.notFence");
	const first = (match[1] ?? "")
		.split("\n")
		.map((line) => line.trim())
		.find((line) => line && !line.startsWith("%%"));
	if (!first) return t("ai.error.empty");
	const type = first.split(/\s+/)[0] ?? "";
	return DIAGRAM_TYPES.has(type) ? undefined : t("ai.error.unknownType", { type });
}

/** Answer of the fake connection (development only): a diagram that passes syntax validation. If there is a diagram to fix, one node line is added. */
const fakeMermaid =
	(site: AiTextSite) =>
	(input: Readonly<Record<string, string>>): string => {
		const fence = input.block?.trim().match(/^(```mermaid[^\n]*\n[\s\S]*?)\n?(```)$/);
		if (fence) return `${fence[1]}\n  fake["(fake)"]\n${fence[2]}`;
		const title = (input.title?.trim() || textOf(site)("ai.fake.title")).replaceAll('"', "'");
		return `\`\`\`mermaid\ngraph TD\n  fake["(fake) ${title}"]\n\`\`\``;
	};

const diagram = diagramAi({
	block: "mermaid",
	syntaxName: "mermaid-syntax",
	text: (site) => textOf(site) as DiagramAiText,
	validate: validateMermaid,
	fake: fakeMermaid,
});

/** Result syntax validation (code validation). It can also be added to other features through `checks`. */
export const mermaidSyntax = diagram.syntax;

export const mermaidAi = { draft: diagram.draft, edit: diagram.edit };

/** What `mermaid()` adds to the AI plugin. The feature names are the keys of the values edited in the admin AI screen. */
export const mermaidAiContribution = {
	actions: { diagramDraft: mermaidAi.draft(), diagramEdit: mermaidAi.edit() },
} satisfies AiContribution;
