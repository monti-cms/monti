"use client";
import { SquareStack } from "lucide-react";
import { TabNodeView, TabsNodeView } from "./view.js";
/** The tabs block's editing view and menu icon. */
export const tabsComponents = {
    blockViews: { tabs: TabsNodeView, tab: TabNodeView },
    icons: { "square-stack": SquareStack },
};
