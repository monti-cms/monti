"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import { MessageSquare } from "lucide-react";
import type { ReactNode } from "react";
import { NoticeView } from "./view";

const components: CmsAdminComponents = {
	blockViews: { notice: NoticeView }, // by block name
	icons: { "message-square": MessageSquare }, // the menu icon, when the name is not among the admin's own
};

/** Registers the notice's editor view and menu icon in the admin. */
export function NoticeProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
