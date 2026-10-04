/**
 * Mermaid diagram (` ```mermaid `). On the server and before loading it shows the source, then loads `mermaid` (optional dependency) in the browser and
 * turns it into a diagram. If loading fails or the syntax is wrong, the source and the error text stay as they are. Redrawn when the theme changes.
 */
export declare function MermaidView({ source }: {
    source: string;
}): import("react").JSX.Element;
