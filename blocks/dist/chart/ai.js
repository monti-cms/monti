// The AI plugin is an optional dependency, so only its types are read (the block extension never loads AI plugin code).
import { createActiveTranslator } from "@monti-cms/core";
import { normalizeChartDsl, parseChartDsl } from "./dsl.js";
import { chartMessages } from "./messages.js";
/**
 * AI features of the chart block (only for sites using `@monti-cms/ai`). The `chart()` plugin adds them via `contributes.ai`, so they
 * attach automatically on sites that use the AI plugin (`chartDraft`, `chartEdit`). To change the instructions, set the same name; to turn one off, give `false`.
 *
 * ```ts
 * aiPlugin({ actions: { chartDraft: chartAi.draft({ prompt: "…" }), chartEdit: false } })
 * ```
 */
// This module is read by the site config file, so the UI language is picked when the text is read.
const t = createActiveTranslator(chartMessages);
const lines = (...text) => text.join("\n");
/** `label` is a getter resolved when the text is read, so merge property definitions instead of copying values. */
const codeCheck = (check) => Object.defineProperties({ kind: "code" }, Object.getOwnPropertyDescriptors(check));
/** Description of the chart syntax (`parseChartDsl`). Goes into the instructions. */
export const chartSyntaxGuide = () => t("ai.guide");
/** Code validator: is the answer a single ```chart code fence that matches the chart syntax (`parseChartDsl`, `normalizeChartDsl`). */
export function validateChart(value) {
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
export const chartSyntax = codeCheck({
    name: "chart-syntax",
    get label() {
        return t("ai.check.label");
    },
    run: validateChart,
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
    draft: (options = {}) => ({
        get label() {
            return t("ai.draft.label");
        },
        input: {
            title: {
                kind: "text",
                get label() {
                    return t("ai.input.title");
                },
            },
            body: {
                kind: "mdx",
                get label() {
                    return t("ai.input.body");
                },
            },
        },
        result: "mdx",
        stream: true,
        askInstruction: true,
        get prompt() {
            return options.prompt ?? lines(t("ai.draft.prompt"), "", chartSyntaxGuide());
        },
        checks: [chartSyntax],
        fake: fakeChart,
        attach: [{ slot: "insert" }],
    }),
    /** Edit chart. Edits as requested from beside the block handle, shows what changed, then replaces the block. */
    edit: (options = {}) => ({
        get label() {
            return t("ai.edit.label");
        },
        input: {
            block: {
                kind: "mdx",
                get label() {
                    return t("ai.input.block");
                },
                required: true,
            },
            title: {
                kind: "text",
                get label() {
                    return t("ai.input.title");
                },
            },
        },
        result: "mdx",
        stream: true,
        askInstruction: true,
        get prompt() {
            return options.prompt ?? lines(t("ai.edit.prompt"), "", chartSyntaxGuide());
        },
        checks: [chartSyntax],
        fake: fakeChart,
        attach: [{ slot: "block", block: "chart" }],
    }),
};
/** What `chart()` adds to the AI plugin. The feature name is the key of the value edited in the admin AI screen. */
export const chartAiContribution = {
    actions: { chartDraft: chartAi.draft(), chartEdit: chartAi.edit() },
};
