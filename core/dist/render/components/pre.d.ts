import type { CSSProperties, ReactNode } from "react";
export interface CmsPreProps {
    readonly children?: ReactNode;
    /** Original code (copy button). Added by code highlighting. */
    readonly code?: string;
    /** File name (`title="src/a.ts"`). If present, the title row is shown. */
    readonly title?: string;
    /** Line numbers (code fence meta `lnum` and `showLineNumbers`). */
    readonly lnum?: boolean | string;
    readonly showLineNumbers?: boolean;
    /** Tooltip descriptions inside code (in number order, JSON array). On screens without hover, they appear as a list below the code. */
    readonly notes?: string;
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly copyLabel?: string;
    readonly copiedLabel?: string;
    readonly notesLabel?: string;
}
/**
 * Code block frame (the `<pre>` made by code highlighting). Attaches the title row, copy button, line numbers and the in-code tooltip list, and does not let the attributes
 * the highlighter leaves (`code`, `title`, `lnum`, `notes`) flow into `<pre>` as they are.
 */
export declare function CmsPre({ children, code, title, lnum, showLineNumbers, notes, className, style, copyLabel, copiedLabel, notesLabel, }: CmsPreProps): import("react").JSX.Element;
