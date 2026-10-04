"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { CmsAdminComponentsProvider } from "@monti-cms/admin";
import { MessageSquareWarning } from "lucide-react";
import { CalloutNodeView } from "./view.js";
const components = {
    blockViews: { callout: CalloutNodeView },
    icons: { "message-square-warning": MessageSquareWarning },
};
/** Registers the callout block's editing view and menu icon in the admin UI. */
export function CalloutProvider({ children }) {
    return _jsx(CmsAdminComponentsProvider, { components: components, children: children });
}
