"use client";
import { Workflow } from "lucide-react";
/** The Mermaid diagram block's menu icon and editor preview. */
export const mermaidComponents = {
    icons: { workflow: Workflow },
    // Default preview. `mermaid` is loaded only when a preview is opened. If a site registers one under the same name, that one wins (inner provider).
    fencePreviews: { mermaid: () => import("./preview.js").then(({ MermaidPreview }) => MermaidPreview) },
};
