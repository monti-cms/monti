"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import { ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { CollapsibleNodeView } from "./view";

const components: CmsAdminComponents = {
	blockViews: { collapsible: CollapsibleNodeView },
	icons: { "chevrons-up-down": ChevronsUpDown },
};

/** Registers the collapsible block's editing view and menu icon in the admin UI. */
export function CollapsibleProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
