"use client";

import { type AdminComponents, AdminComponentsProvider } from "@monti-cms/admin";
import { GitBranch } from "lucide-react";
import type { ReactNode } from "react";

const components: AdminComponents = {
	// The icon of the sidebar item (`nav`), picked by name.
	icons: { "git-branch": GitBranch },
};

/** What the git-sync plugin adds to the whole admin screen: the icon of its sidebar item. */
export function GitSyncAdminProvider({ children }: { children: ReactNode }) {
	return <AdminComponentsProvider components={components}>{children}</AdminComponentsProvider>;
}
