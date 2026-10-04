"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { CmsAdminComponentsProvider } from "@monti-cms/admin";
import { Workflow } from "lucide-react";
const components = {
    icons: { workflow: Workflow },
    // Default preview. `mermaid` is loaded only when a preview is opened. If a site registers one under the same name, that one wins (inner provider).
    fencePreviews: { mermaid: () => import("./preview.js").then(({ MermaidPreview }) => MermaidPreview) },
};
/** Registers the Mermaid diagram block's menu icon and editor preview in the admin UI. */
export function MermaidProvider({ children }) {
    return _jsx(CmsAdminComponentsProvider, { components: components, children: children });
}
