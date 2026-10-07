"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import { GitBranch } from "lucide-react";
import type { ReactNode } from "react";
import { useDraftPrExtension } from "./draft-pr-link";

const components: CmsAdminComponents = {
	// The "Draft PR" link on the entry page.
	editorExtensions: [useDraftPrExtension],
	// The icon of the sidebar item (`nav`), picked by name.
	icons: { "git-branch": GitBranch },
};

/** What the git-sync plugin adds to the whole admin screen: the icon of its sidebar item, and the "Draft PR" link on the entry page. */
export function GitSyncAdminProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}
