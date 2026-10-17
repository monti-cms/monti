/** Rendering of the Mermaid block (` ```mermaid `). The code is the `source` attribute (`remarkFenceBlocksToMdx`). */
export declare function Mermaid({ source }: {
    source?: string;
}): import("react").JSX.Element;
/** Public components for Mermaid in the JSON renderer (`renderDocument`): the block `mermaid`. The code of the fence arrives as `source`. */
declare const _default: import("@monti-cms/core/render").RenderPlugin;
export default _default;
