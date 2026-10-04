import type { ReactNode } from "react";
/**
 * `:::text-align{align}` container. Only validated values are turned into fixed classes (values are not put into className or style as they are).
 * Disallowed values fall back to the default alignment.
 */
export declare function CmsTextAlign({ align, children }: {
    align?: string;
    children?: ReactNode;
}): import("react").JSX.Element;
