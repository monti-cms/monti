import { type ReactNode } from "react";
/**
 * Registers the MDX format and its source panel in the admin (`useCmsAdminComponents().sourcePanels`, `useFormat("mdx")`). The admin renders it for the
 * `mdx()` plugin; without the plugin there is no source toggle and no `mdx` format in the browser.
 */
export declare function MdxAdminProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
