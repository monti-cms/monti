"use client";

import type { AdminComponents } from "@monti-cms/admin";
import { CollapsibleNodeView } from "./view";

/** The collapsible block's editing view. */
export const collapsibleComponents: AdminComponents = {
	blockViews: { collapsible: CollapsibleNodeView },
};
