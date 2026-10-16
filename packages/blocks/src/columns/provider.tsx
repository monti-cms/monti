"use client";

import type { AdminComponents } from "@monti-cms/admin";
import { Columns2 } from "lucide-react";
import { ColumnNodeView, ColumnsNodeView } from "./view";

/** The columns block's editing view and menu icon. */
export const columnsComponents: AdminComponents = {
	blockViews: { columns: ColumnsNodeView, column: ColumnNodeView },
	icons: { "columns-2": Columns2 },
};
