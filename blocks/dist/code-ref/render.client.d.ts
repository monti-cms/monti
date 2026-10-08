import { type PropsWithChildren } from "react";
/** Fixed text of the public component. The site language picks it in `render.tsx` (`messages.ts`). */
export interface CodeRefLabels {
    /** Accessible label of the back-link button on the code line (code to text). */
    readonly back: string;
}
/**
 * Link between body text and code lines (`:code-ref[text]{to="c1"}`). Hovering or focusing the text highlights the linked code lines and
 * dims the other lines of the same code block (`pre[data-code-focus]`, `.line[data-focused]`, `@monti-cms/core/render.css`).
 * Pressing it, or pressing Enter or Space, scrolls to the line when the code is off screen (expanding collapsed areas) and keeps the highlight briefly.
 * While the linked lines are off screen, hovering or focusing also shows a small preview of them next to the text (`role="tooltip"`, hidden on leave, blur, or Esc).
 * The first text that points to a label adds a back-link button to the end of the first linked line, which scrolls back to that text (`data-focused`).
 * A link resolves to exactly one code block (the first one that has the label). If the linked line is not found (a deleted anchor), the text appears as unlinked text.
 */
export declare function CodeRef({ to, labels, children, }: PropsWithChildren<{
    to: string;
    labels?: CodeRefLabels;
}>): import("react").JSX.Element;
