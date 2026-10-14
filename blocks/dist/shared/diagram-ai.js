/**
 * The AI actions of a block that is a code fence with a small language (chart, Mermaid): create one from the slash menu, and edit one from beside the block handle. Both
 * take the block's own texts, check that the answer is a single fence of the block that parses, and attach where the block lives.
 */
export function diagramAi(spec) {
    const withGuide = (site, prompt) => spec.guide ? [prompt, "", spec.guide(site)].join("\n") : prompt;
    /** Result syntax check (code validator). It can also be added to other actions through `checks`. */
    const syntax = (site) => ({
        kind: "code",
        name: spec.syntaxName,
        label: spec.text(site)("ai.check.label"),
        run: (value) => spec.validate(site, value),
    });
    return {
        syntax,
        /** Create. Takes a request from the slash menu and inserts the block at the cursor. */
        draft: (options = {}) => (site) => {
            const t = spec.text(site);
            return {
                label: t("ai.draft.label"),
                input: {
                    title: { kind: "text", label: t("ai.input.title") },
                    body: { kind: "mdx", label: t("ai.input.body") },
                },
                result: "mdx",
                stream: true,
                askInstruction: true,
                prompt: options.prompt ?? withGuide(site, t("ai.draft.prompt")),
                checks: [syntax(site)],
                fake: spec.fake(site),
                attach: [{ slot: "insert" }],
            };
        },
        /** Edit. Edits as requested from beside the block handle, shows what changed, then replaces the block. */
        edit: (options = {}) => (site) => {
            const t = spec.text(site);
            return {
                label: t("ai.edit.label"),
                input: {
                    block: { kind: "mdx", label: t("ai.input.block"), required: true },
                    title: { kind: "text", label: t("ai.input.title") },
                },
                result: "mdx",
                stream: true,
                askInstruction: true,
                prompt: options.prompt ?? withGuide(site, t("ai.edit.prompt")),
                checks: [syntax(site)],
                fake: spec.fake(site),
                attach: [{ slot: "block", block: spec.block }],
            };
        },
    };
}
