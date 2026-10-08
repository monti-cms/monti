"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import type { ReactNode } from "react";
import { ReadingTimeView } from "./view";

const components: CmsAdminComponents = { fieldViews: { "reading-time": ReadingTimeView } }; // by the `view` name of the field

export function ReadingTimeProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
