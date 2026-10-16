"use client";

import { type AdminComponents, AdminComponentsProvider } from "@monti-cms/admin";
import { Workflow } from "lucide-react";
import type { ReactNode } from "react";

const components: AdminComponents = {
	icons: { workflow: Workflow },
	// Default preview. `mermaid` is loaded only when a preview is opened. If a site registers one under the same name, that one wins (inner provider).
	fencePreviews: { mermaid: () => import("./preview").then(({ MermaidPreview }) => MermaidPreview) },
};

/** Registers the Mermaid diagram block's menu icon and editor preview in the admin UI. */
export function MermaidProvider({ children }: { children: ReactNode }) {
	return <AdminComponentsProvider components={components}>{children}</AdminComponentsProvider>;
}
