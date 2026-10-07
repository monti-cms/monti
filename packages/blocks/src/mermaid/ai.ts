// The AI plugin is an optional dependency, so only types are imported (the block extension never loads AI plugin code).

import type { AiActionDefinition, AiContribution } from "@monti-cms/ai";
import type { Site } from "@monti-cms/core/client";
import { mermaidMessages } from "./messages";

/**
 * AI features of the Mermaid block (only for sites using `@monti-cms/ai`). The `mermaid()` plugin adds them via `contributes.ai`, so they attach automatically
 * on sites that use the AI plugin (`diagramDraft`, `diagramEdit`). To change the instructions, write an entry with the same name; to turn one off, give `false`.
 *
 * ```ts
 * aiPlugin({ actions: { diagramDraft: mermaidAi.draft({ prompt: "…" }), diagramEdit: false } })
 * ```
 *
 * The actions are factories (`AiActionFactory`): the AI plugin calls them with the site, so the text is in that site's admin language.
 */

/** What the actions read from the site: its admin-language translator (the actions are created per site). */
export type AiTextSite = Pick<Site, "createTranslator">;

const textOf = (site: AiTextSite) => site.createTranslator(mermaidMessages);

/**
 * Code validation (same shape as `AiValidator` and `defineValidator` of `@monti-cms/ai`). The shape is written out here so the published type declarations do not
 * reference the AI plugin (sites without the AI plugin still pass type checking). The `satisfies` below checks that the shape matches.
 */
export interface CodeCheck {
	readonly kind: "code";
	readonly name: string;
	readonly label: string;
	readonly run: (value: string) => string | undefined;
}
const codeCheck = (check: Omit<CodeCheck, "kind">): CodeCheck => ({ kind: "code", ...check });

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

/** Result syntax validation (code validation). It can also be added to other features through `checks`. */
export const mermaidSyntax = (site: AiTextSite): CodeCheck =>
	codeCheck({
		name: "mermaid-syntax",
		label: textOf(site)("ai.check.label"),
		run: (value) => validateMermaid(site, value),
	});

/** Answer of the fake connection (development only): a diagram that passes syntax validation. If there is a diagram to fix, one node line is added. */
const fakeMermaid =
	(site: AiTextSite) =>
	(input: Readonly<Record<string, string>>): string => {
		const fence = input.block?.trim().match(/^(```mermaid[^\n]*\n[\s\S]*?)\n?(```)$/);
		if (fence) return `${fence[1]}\n  fake["(fake)"]\n${fence[2]}`;
		const title = (input.title?.trim() || textOf(site)("ai.fake.title")).replaceAll('"', "'");
		return `\`\`\`mermaid\ngraph TD\n  fake["(fake) ${title}"]\n\`\`\``;
	};

export const mermaidAi = {
	/** Create a diagram. Takes a request from the slash menu and inserts a Mermaid block at the cursor. */
	draft:
		(options: { readonly prompt?: string } = {}) =>
		(site: AiTextSite) => {
			const t = textOf(site);
			return {
				label: t("ai.draft.label"),
				input: {
					title: { kind: "text", label: t("ai.input.title") },
					body: { kind: "mdx", label: t("ai.input.body") },
				},
				result: "mdx",
				stream: true,
				askInstruction: true,
				prompt: options.prompt ?? t("ai.draft.prompt"),
				checks: [mermaidSyntax(site)],
				fake: fakeMermaid(site),
				attach: [{ slot: "insert" }],
			} as const satisfies AiActionDefinition;
		},

	/** Edit a diagram. Edits as requested from next to the block handle, shows what changed, and then replaces the block. */
	edit:
		(options: { readonly prompt?: string } = {}) =>
		(site: AiTextSite) => {
			const t = textOf(site);
			return {
				label: t("ai.edit.label"),
				input: {
					block: { kind: "mdx", label: t("ai.input.block"), required: true },
					title: { kind: "text", label: t("ai.input.title") },
				},
				result: "mdx",
				stream: true,
				askInstruction: true,
				prompt: options.prompt ?? t("ai.edit.prompt"),
				checks: [mermaidSyntax(site)],
				fake: fakeMermaid(site),
				attach: [{ slot: "block", block: "mermaid" }],
			} as const satisfies AiActionDefinition;
		},
};

/** What `mermaid()` adds to the AI plugin. The feature names are the keys of the values edited in the admin AI screen. */
export const mermaidAiContribution = {
	actions: { diagramDraft: mermaidAi.draft(), diagramEdit: mermaidAi.edit() },
} satisfies AiContribution;
