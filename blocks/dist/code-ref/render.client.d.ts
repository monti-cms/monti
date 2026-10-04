import { type PropsWithChildren } from "react";
/**
 * Link between body text and code lines (`:code-ref[text]{to="c1"}`). Hovering or focusing the text highlights the linked code lines and
 * dims the other lines of the same code block (`pre[data-code-focus]`, `.line[data-focused]`, `@monti-cms/core/render.css`).
 * Pressing it, or pressing Enter or Space, scrolls to the line when the code is off screen (expanding collapsed areas) and keeps the highlight briefly.
 * If the linked line is not found (a deleted anchor), the text appears as unlinked text.
 */
export declare function CodeRef({ to, children }: PropsWithChildren<{
    to: string;
}>): import("react").JSX.Element;
