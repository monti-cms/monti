"use client";

import type { AdminComponents } from "@monti-cms/admin";
import { SquareStack } from "lucide-react";
import { TabNodeView, TabsNodeView } from "./view";

/** The tabs block's editing view and menu icon. */
export const tabsComponents: AdminComponents = {
	blockViews: { tabs: TabsNodeView, tab: TabNodeView },
	icons: { "square-stack": SquareStack },
};
