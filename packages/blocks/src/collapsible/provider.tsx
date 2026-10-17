"use client";

import type { AdminComponents } from "@monti-cms/admin";
import { ChevronsUpDown } from "lucide-react";
import { CollapsibleNodeView } from "./view";

/** The collapsible block's editing view and menu icon. */
export const collapsibleComponents: AdminComponents = {
	blockViews: { collapsible: CollapsibleNodeView },
	icons: { "chevrons-up-down": ChevronsUpDown },
};
