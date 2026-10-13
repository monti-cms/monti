import type { ReactNode } from "react";
/** The frame of a plugin page (`<admin path>/tools/<path>`): sidebar and the `nav` label as the title. `children` is the plugin's page, rendered by the server. */
export declare function ToolsScreen({ path, children }: {
    path: string;
    children: ReactNode;
}): import("react").JSX.Element;
