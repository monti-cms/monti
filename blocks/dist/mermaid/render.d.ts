/** Rendering of the Mermaid block (` ```mermaid `). The code is the `source` attribute (`remarkFenceBlocksToMdx`). */
export declare function Mermaid({ source }: {
    source?: string;
}): import("react").JSX.Element;
export default _default;
/** Public component for Mermaid (called by `@monti-cms/core/render`). The diagram is drawn in the browser (optional dependency `mermaid`). */
declare function _default(): {
    Mermaid: typeof Mermaid;
};
