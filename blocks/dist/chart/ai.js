// The AI plugin is an optional dependency, so only its types are read (the block extension never loads AI plugin code).
import { normalizeChartDsl, parseChartDsl } from "./dsl.js";
import { chartMessages } from "./messages.js";
const textOf = (site) => site.createTranslator(chartMessages);
const lines = (...text) => text.join("\n");
const codeCheck = (check) => ({ kind: "code", ...check });
/** Description of the chart syntax (`parseChartDsl`). Goes into the instructions. */
export const chartSyntaxGuide = (site) => textOf(site)("ai.guide");
/** Code validator: is the answer a single ```chart code fence that matches the chart syntax (`parseChartDsl`, `normalizeChartDsl`). */
export function validateChart(site, value) {
    const t = textOf(site);
    const match = value.trim().match(/^```chart[^\n]*\n([\s\S]*?)\n?```$/);
    if (!match)
        return t("ai.error.notFence");
    const { errors } = normalizeChartDsl(parseChartDsl(match[1] ?? ""));
    const [first] = errors;
    return first
        ? t("ai.error.syntax", { line: first.line, message: t(`error.${first.code}`, first.values) })
        : undefined;
}
/** Result syntax check (code validator). Can also be added to other features via `checks`. */
export const chartSyntax = (site) => codeCheck({
    name: "chart-syntax",
    label: textOf(site)("ai.check.label"),
    run: (value) => validateChart(site, value),
});
/** Answer from the fake connection (dev only): a chart that passes the syntax check. If there is a chart to edit, repeats its last value row once. */
function fakeChart(input) {
    const fence = input.block?.trim().match(/^(```chart[^\n]*\n[\s\S]*?)\n?(```)$/);
    if (fence) {
        const body = fence[1] ?? "";
        return `${body}\n${body.trimEnd().split("\n").at(-1) ?? ""}\n${fence[2]}`;
    }
    const label = (input.title?.trim() || "(fake)").replaceAll("|", " ");
    return lines("```chart", "chart bar", "x label", "series value | (fake) | chart-1", "", "data", "label | value", `${label} | 1`, "```");
}
export const chartAi = {
    /** Create chart. Takes a request from the slash menu and inserts a chart block at the cursor. */
    draft: (options = {}) => (site) => {
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
            prompt: options.prompt ?? lines(t("ai.draft.prompt"), "", chartSyntaxGuide(site)),
            checks: [chartSyntax(site)],
            fake: fakeChart,
            attach: [{ slot: "insert" }],
        };
    },
    /** Edit chart. Edits as requested from beside the block handle, shows what changed, then replaces the block. */
    edit: (options = {}) => (site) => {
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
            prompt: options.prompt ?? lines(t("ai.edit.prompt"), "", chartSyntaxGuide(site)),
            checks: [chartSyntax(site)],
            fake: fakeChart,
            attach: [{ slot: "block", block: "chart" }],
        };
    },
};
/** What `chart()` adds to the AI plugin. The feature name is the key of the value edited in the admin AI screen. */
export const chartAiContribution = {
    actions: { chartDraft: chartAi.draft(), chartEdit: chartAi.edit() },
};
