"use client";
import { ChartColumn } from "lucide-react";
/** Adds the chart block's menu icon and editor preview to the admin UI. */
export const chartComponents = {
    icons: { "chart-column": ChartColumn },
    // Default preview. Loads `recharts` only when a preview is opened. If the site registers one under the same name, that one wins (inner provider).
    fencePreviews: { chart: () => import("./preview.js").then(({ ChartPreview }) => ChartPreview) },
};
