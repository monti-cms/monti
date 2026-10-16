"use client";

import { type AdminComponents, AdminComponentsProvider } from "@monti-cms/admin";
import { Columns2 } from "lucide-react";
import type { ReactNode } from "react";
import { ColumnNodeView, ColumnsNodeView } from "./view";

const components: AdminComponents = {
	blockViews: { columns: ColumnsNodeView, column: ColumnNodeView },
	icons: { "columns-2": Columns2 },
};

/** Registers the columns block's editing view and menu icon in the admin UI. */
export function ColumnsProvider({ children }: { children: ReactNode }) {
	return <AdminComponentsProvider components={components}>{children}</AdminComponentsProvider>;
}
