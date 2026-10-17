import { jsx as _jsx } from "react/jsx-runtime";
import { defineRender } from "@monti-cms/core/render";
import { MermaidView } from "./render.client.js";
/** Rendering of the Mermaid block (` ```mermaid `). The code is the `source` attribute (`remarkFenceBlocksToMdx`). */
export function Mermaid({ source }) {
    return _jsx(MermaidView, { source: source ?? "" });
}
/** Public components for Mermaid in the JSON renderer (`renderDocument`): the block `mermaid`. The code of the fence arrives as `source`. */
export default defineRender({
    blocks: { mermaid: ({ source }) => _jsx(Mermaid, { source: source }) },
});
