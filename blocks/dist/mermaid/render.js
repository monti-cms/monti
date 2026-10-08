import { jsx as _jsx } from "react/jsx-runtime";
import { MermaidView } from "./render.client.js";
/** Rendering of the Mermaid block (` ```mermaid `). The code is the `source` attribute (`remarkFenceBlocksToMdx`). */
export function Mermaid({ source }) {
    return _jsx(MermaidView, { source: source ?? "" });
}
/** Public components for Mermaid in the JSON renderer (`renderDocument`): the block `mermaid`. The code of the fence arrives as `source`. */
export const documentComponents = (_context) => ({
    blocks: { mermaid: ({ source }) => _jsx(Mermaid, { source: source }) },
});
