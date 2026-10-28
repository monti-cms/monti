"use client";

import { SplitScreen } from "@carbon/icons-react";
import type { AdminComponents } from "@monti-cms/admin";
import { ColumnNodeView, ColumnsNodeView } from "./view";

/** The columns block's editing view and menu icon. */
export const columnsComponents: AdminComponents = {
	blockViews: { columns: ColumnsNodeView, column: ColumnNodeView },
	icons: { "split-screen": SplitScreen },
};
