// The AI plugin is an optional dependency, so only types are imported (the block extension never loads AI plugin code).
import { createActiveTranslator } from "@monti-cms/core";
import { mermaidMessages } from "./messages.js";
/**
 * AI features of the Mermaid block (only for sites using `@monti-cms/ai`). The `mermaid()` plugin adds them via `contributes.ai`, so they attach automatically
 * on sites that use the AI plugin (`diagramDraft`, `diagramEdit`). To change the instructions, write an entry with the same name; to turn one off, give `false`.
 *
 * ```ts
 * aiPlugin({ actions: { diagramDraft: mermaidAi.draft({ prompt: "…" }), diagramEdit: false } })
 * ```
 */
// This module is read by the site config file, so the UI language is resolved when the text is read.
const t = createActiveTranslator(mermaidMessages);
/** `label` is a getter resolved when the text is read, so merge the property definitions instead of copying values. */
const codeCheck = (check) => Object.defineProperties({ kind: "code" }, Object.getOwnPropertyDescriptors(check));
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
export function validateMermaid(value) {
    const match = value.trim().match(/^```mermaid[^\n]*\n([\s\S]*?)\n?```$/);
    if (!match)
        return t("ai.error.notFence");
    const first = (match[1] ?? "")
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line && !line.startsWith("%%"));
    if (!first)
        return t("ai.error.empty");
    const type = first.split(/\s+/)[0] ?? "";
    return DIAGRAM_TYPES.has(type) ? undefined : t("ai.error.unknownType", { type });
}
/** Result syntax validation (code validation). It can also be added to other features through `checks`. */
export const mermaidSyntax = codeCheck({
    name: "mermaid-syntax",
    get label() {
        return t("ai.check.label");
    },
    run: validateMermaid,
});
/** Answer of the fake connection (development only): a diagram that passes syntax validation. If there is a diagram to fix, one node line is added. */
function fakeMermaid(input) {
    const fence = input.block?.trim().match(/^(```mermaid[^\n]*\n[\s\S]*?)\n?(```)$/);
    if (fence)
        return `${fence[1]}\n  fake["(fake)"]\n${fence[2]}`;
    const title = (input.title?.trim() || t("ai.fake.title")).replaceAll('"', "'");
    return `\`\`\`mermaid\ngraph TD\n  fake["(fake) ${title}"]\n\`\`\``;
}
export const mermaidAi = {
    /** Create a diagram. Takes a request from the slash menu and inserts a Mermaid block at the cursor. */
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
            return options.prompt ?? t("ai.draft.prompt");
        },
        checks: [mermaidSyntax],
        fake: fakeMermaid,
        attach: [{ slot: "insert" }],
    }),
    /** Edit a diagram. Edits as requested from next to the block handle, shows what changed, and then replaces the block. */
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
            return options.prompt ?? t("ai.edit.prompt");
        },
        checks: [mermaidSyntax],
        fake: fakeMermaid,
        attach: [{ slot: "block", block: "mermaid" }],
    }),
};
/** What `mermaid()` adds to the AI plugin. The feature names are the keys of the values edited in the admin AI screen. */
export const mermaidAiContribution = {
    actions: { diagramDraft: mermaidAi.draft(), diagramEdit: mermaidAi.edit() },
};
