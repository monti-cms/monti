"use client";

import { useSite } from "@monti-cms/core/client";
import type { ReactNode } from "react";
import { toolsPages } from "../settings/tabs";
import { AdminShell } from "../shared/admin-shell";

/** The frame of a plugin page (`<admin path>/tools/<path>`): sidebar and the `nav` label as the title. `children` is the plugin's page, rendered by the server. */
export function ToolsScreen({ path, children }: { path: string; children: ReactNode }) {
	const site = useSite();
	const label = toolsPages(site).find((page) => page.path === path)?.label ?? path;
	return (
		<AdminShell title={label} sidebar={{ activeNav: `tools:${path}` }}>
			{children}
		</AdminShell>
	);
}
