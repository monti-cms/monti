import { type PropsWithChildren } from "react";
/**
 * Tooltip (`:tooltip[text]{content="description"}`). Hovering or keyboard focus shows the description, and on touch it opens and closes with a tap.
 * Esc closes it. Even when hidden, the description is read by screen readers through `aria-describedby`. `note` is the annotation number of a tooltip inside code,
 * and the number is shown next to the text only on touch devices (CSS).
 */
export declare function Tooltip({ content, note, children }: PropsWithChildren<{
    content?: string;
    note?: string | number;
}>): import("react").JSX.Element;
