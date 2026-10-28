"use client";

import { ChartColumn } from "@carbon/icons-react";
import type { AdminComponents } from "@monti-cms/admin";

/** Adds the chart block's menu icon and editor preview to the admin UI. */
export const chartComponents: AdminComponents = {
	icons: { "chart--column": ChartColumn },
	// Default preview. Loads `recharts` only when a preview is opened. If the site registers one under the same name, that one wins (inner provider).
	fencePreviews: { chart: () => import("./preview").then(({ ChartPreview }) => ChartPreview) },
};
