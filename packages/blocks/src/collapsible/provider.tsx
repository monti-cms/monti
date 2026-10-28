"use client";

import { ChevronSort } from "@carbon/icons-react";
import type { AdminComponents } from "@monti-cms/admin";
import { CollapsibleNodeView } from "./view";

/** The collapsible block's editing view and menu icon. */
export const collapsibleComponents: AdminComponents = {
	blockViews: { collapsible: CollapsibleNodeView },
	icons: { "chevron--sort": ChevronSort },
};
