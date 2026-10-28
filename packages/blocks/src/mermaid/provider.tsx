"use client";

import { WorkflowAutomation } from "@carbon/icons-react";
import type { AdminComponents } from "@monti-cms/admin";

/** The Mermaid diagram block's menu icon and editor preview. */
export const mermaidComponents: AdminComponents = {
	icons: { "workflow-automation": WorkflowAutomation },
	// Default preview. `mermaid` is loaded only when a preview is opened. If a site registers one under the same name, that one wins (inner provider).
	fencePreviews: { mermaid: () => import("./preview").then(({ MermaidPreview }) => MermaidPreview) },
};
