"use client";
import { Columns2 } from "lucide-react";
import { ColumnNodeView, ColumnsNodeView } from "./view.js";
/** The columns block's editing view and menu icon. */
export const columnsComponents = {
    blockViews: { columns: ColumnsNodeView, column: ColumnNodeView },
    icons: { "columns-2": Columns2 },
};
