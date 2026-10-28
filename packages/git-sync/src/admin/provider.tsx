"use client";

import { Branch } from "@carbon/icons-react";
import type { AdminComponents } from "@monti-cms/admin";

/** The git-sync page's sidebar icon. */
export const gitSyncComponents: AdminComponents = {
	// The icon of the sidebar item (`nav`), picked by name.
	icons: { branch: Branch },
};
