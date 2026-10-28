"use client";

import { Copy } from "@carbon/icons-react";
import type { AdminComponents } from "@monti-cms/admin";
import { TabNodeView, TabsNodeView } from "./view";

/** The tabs block's editing view and menu icon. */
export const tabsComponents: AdminComponents = {
	blockViews: { tabs: TabsNodeView, tab: TabNodeView },
	icons: { copy: Copy },
};
