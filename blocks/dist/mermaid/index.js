import { definePlugin } from "@monti-cms/core";
import { mermaidAiContribution } from "./ai.js";
import { mermaidBlock } from "./definition.js";
export { mermaidBlock } from "./definition.js";
/**
 * Mermaid diagram block (` ```mermaid `). Add it to the site config's `plugins`.
 *
 * ```ts
 * plugins: [mermaid()]
 * ```
 *
 * The editor edits with a code input and a preview. This extension draws the preview (install the optional dependency `mermaid`). A site can
 * replace it with `fencePreviews.mermaid`. The public page is drawn by this extension's default `Mermaid` component, which a site can override (the code is the `source` attribute,
 * `remarkFenceBlocksToMdx`).
 */
export const mermaid = () => definePlugin({
    name: "mermaid",
    options: {},
    blocks: [mermaidBlock],
    admin: () => import("@monti-cms/blocks/mermaid/admin"),
    render: () => import("@monti-cms/blocks/mermaid/render"),
    // If the AI plugin is present, the create and edit features attach automatically (`./ai`).
    contributes: { ai: mermaidAiContribution },
});
