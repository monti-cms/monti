import { type ReactNode } from "react";
/**
 * The switching part of the tab group. Renders the tab name row (`tablist`) and each tab's body (`tabpanel`). The server renders and passes the bodies, so here
 * only the visible tab is switched (the rest are `hidden`). Arrow keys, Home and End move between tabs, and only the selected tab is reachable with the Tab key.
 */
export declare function TabsView({ labels, panels, defaultIndex, }: {
    readonly labels: readonly string[];
    readonly panels: readonly ReactNode[];
    readonly defaultIndex?: number;
}): import("react").JSX.Element;
