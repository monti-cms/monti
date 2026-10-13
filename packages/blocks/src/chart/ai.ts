import type { AiContribution } from "@monti-cms/core/ai-contract";
import { type AiTextSite, type DiagramAiText, diagramAi } from "../shared/diagram-ai";
import { normalizeChartDsl, parseChartDsl } from "./dsl";
import { chartMessages } from "./messages";

export type { AiTextSite } from "../shared/diagram-ai";

/**
 * AI features of the chart block (only for sites using `@monti-cms/ai`). The `chart()` plugin adds them via `contributes.ai`, so they
 * attach automatically on sites that use the AI plugin (`chartDraft`, `chartEdit`). To change the instructions, set the same name; to turn one off, give `false`.
 * The contract types come from `@monti-cms/core/ai-contract`, so this block never depends on the AI plugin.
 *
 * ```ts
 * ai({ actions: { chartDraft: chartAi.draft({ prompt: "…" }), chartEdit: false } })
 * ```
 *
 * The actions are factories (`AiActionFactory`): the AI plugin calls them with the site, so the text is in that site's admin language.
 */

const textOf = (site: AiTextSite) => site.createTranslator(chartMessages);

const lines = (...text: string[]) => text.join("\n");

/** Description of the chart syntax (`parseChartDsl`). Goes into the instructions. */
export const chartSyntaxGuide = (site: AiTextSite): string => textOf(site)("ai.guide");

/** Code validator: is the answer a single ```chart code fence that matches the chart syntax (`parseChartDsl`, `normalizeChartDsl`). */
export function validateChart(site: AiTextSite, value: string): string | undefined {
	const t = textOf(site);
	const match = value.trim().match(/^```chart[^\n]*\n([\s\S]*?)\n?```$/);
	if (!match) return t("ai.error.notFence");
	const { errors } = normalizeChartDsl(parseChartDsl(match[1] ?? ""));
	const [first] = errors;
	return first
		? t("ai.error.syntax", { line: first.line, message: t(`error.${first.code}`, first.values) })
		: undefined;
}

/** Answer from the fake connection (dev only): a chart that passes the syntax check. If there is a chart to edit, repeats its last value row once. */
function fakeChart(input: Readonly<Record<string, string>>): string {
	const fence = input.block?.trim().match(/^(```chart[^\n]*\n[\s\S]*?)\n?(```)$/);
	if (fence) {
		const body = fence[1] ?? "";
		return `${body}\n${body.trimEnd().split("\n").at(-1) ?? ""}\n${fence[2]}`;
	}
	const label = (input.title?.trim() || "(fake)").replaceAll("|", " ");
	return lines(
		"```chart",
		"chart bar",
		"x label",
		"series value | (fake) | chart-1",
		"",
		"data",
		"label | value",
		`${label} | 1`,
		"```",
	);
}

const diagram = diagramAi({
	block: "chart",
	syntaxName: "chart-syntax",
	text: (site) => textOf(site) as DiagramAiText,
	validate: validateChart,
	guide: chartSyntaxGuide,
	fake: () => fakeChart,
});

/** Result syntax check (code validator). Can also be added to other features through `checks`. */
export const chartSyntax = diagram.syntax;

export const chartAi = { draft: diagram.draft, edit: diagram.edit };

/** What `chart()` adds to the AI plugin. The feature name is the key of the value edited in the admin AI screen. */
export const chartAiContribution = {
	actions: { chartDraft: chartAi.draft(), chartEdit: chartAi.edit() },
} satisfies AiContribution;
