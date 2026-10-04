"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import { ChartColumn } from "lucide-react";
import type { ReactNode } from "react";

const components: CmsAdminComponents = {
	icons: { "chart-column": ChartColumn },
	// Default preview. Loads `recharts` only when a preview is opened. If the site registers one under the same name, that one wins (inner provider).
	fencePreviews: { chart: () => import("./preview").then(({ ChartPreview }) => ChartPreview) },
};

/** Adds the chart block's menu icon and editor preview to the admin UI. */
export function ChartProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
