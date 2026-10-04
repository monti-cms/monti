"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { CmsAdminComponentsProvider } from "@monti-cms/admin";
import { ChartColumn } from "lucide-react";
const components = {
    icons: { "chart-column": ChartColumn },
    // Default preview. Loads `recharts` only when a preview is opened. If the site registers one under the same name, that one wins (inner provider).
    fencePreviews: { chart: () => import("./preview.js").then(({ ChartPreview }) => ChartPreview) },
};
/** Adds the chart block's menu icon and editor preview to the admin UI. */
export function ChartProvider({ children }) {
    return _jsx(CmsAdminComponentsProvider, { components: components, children: children });
}
