import { jsx as _jsx } from "react/jsx-runtime";
import { MermaidView } from "./render.client.js";
/** Rendering of the Mermaid block (` ```mermaid `). The code is the `source` attribute (`remarkFenceBlocksToMdx`). */
export function Mermaid({ source }) {
    return _jsx(MermaidView, { source: source ?? "" });
}
/** Public component for Mermaid (called by `@monti-cms/core/render`). The diagram is drawn in the browser (optional dependency `mermaid`). */
export default () => ({ Mermaid });
