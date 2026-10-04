"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { CmsAdminComponentsProvider } from "@monti-cms/admin";
import { Columns2 } from "lucide-react";
import { ColumnNodeView, ColumnsNodeView } from "./view.js";
const components = {
    blockViews: { columns: ColumnsNodeView, column: ColumnNodeView },
    icons: { "columns-2": Columns2 },
};
/** Registers the columns block's editing view and menu icon in the admin UI. */
export function ColumnsProvider({ children }) {
    return _jsx(CmsAdminComponentsProvider, { components: components, children: children });
}
