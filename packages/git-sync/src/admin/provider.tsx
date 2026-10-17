"use client";

import type { AdminComponents } from "@monti-cms/admin";
import { GitBranch } from "lucide-react";

/** The git-sync page's sidebar icon. */
export const gitSyncComponents: AdminComponents = {
	// The icon of the sidebar item (`nav`), picked by name.
	icons: { "git-branch": GitBranch },
};
