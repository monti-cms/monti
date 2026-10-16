"use client";

import { type AdminComponents, AdminComponentsProvider } from "@monti-cms/admin";
import { SquareStack } from "lucide-react";
import type { ReactNode } from "react";
import { TabNodeView, TabsNodeView } from "./view";

const components: AdminComponents = {
	blockViews: { tabs: TabsNodeView, tab: TabNodeView },
	icons: { "square-stack": SquareStack },
};

/** Registers the tabs block's editing view and menu icon in the admin UI. */
export function TabsProvider({ children }: { children: ReactNode }) {
	return <AdminComponentsProvider components={components}>{children}</AdminComponentsProvider>;
}
