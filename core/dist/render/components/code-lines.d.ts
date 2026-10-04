import { type ReactNode } from "react";
/** Code line folding (the `collapse` line effect). The first line is the title and the rest show when expanded. */
export declare function CmsCodeCollapse({ children, open }: {
    children: ReactNode;
    open?: boolean;
}): import("react").JSX.Element;
/** Folding text inside code (the `fold` line effect). Clicking `...` expands it (no script needed). */
export declare function CmsCodeFold({ children, open, label, }: {
    children: ReactNode;
    open?: boolean;
    label?: string;
}): import("react").JSX.Element;
