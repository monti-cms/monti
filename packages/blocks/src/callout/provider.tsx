"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import { MessageSquareWarning } from "lucide-react";
import type { ReactNode } from "react";
import { CalloutNodeView } from "./view";

const components: CmsAdminComponents = {
	blockViews: { callout: CalloutNodeView },
	icons: { "message-square-warning": MessageSquareWarning },
};

/** Registers the callout block's editing view and menu icon in the admin UI. */
export function CalloutProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
