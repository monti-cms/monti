"use client";

import type { AdminComponents } from "@monti-cms/admin";
import { TabNodeView, TabsNodeView } from "./view";

/** The tabs block's editing view. */
export const tabsComponents: AdminComponents = {
	blockViews: { tabs: TabsNodeView, tab: TabNodeView },
};
