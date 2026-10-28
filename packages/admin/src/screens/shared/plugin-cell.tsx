"use client";

import { StatusBarPluginCell as PluginCell } from "@monti-cms/ui";
import type { ComponentProps } from "react";
import { useAdminRouter } from "../../router";

/**
 * The cell a plugin fills in the status bar, with its list: the plugin's name for what it finds, its findings (each with one action), and under a rule
 * the way to the plugin's settings (`settings.href`, an address in the admin) and "Fix all". It draws nothing without findings, and the plugin leaves
 * it out where it has nothing to check.
 */
export function StatusBarPluginCell({
	settings,
	...props
}: Omit<ComponentProps<typeof PluginCell>, "settings"> & { settings?: { label: string; href: string } }) {
	const router = useAdminRouter();
	return (
		<PluginCell
			{...props}
			settings={settings && { label: settings.label, onClick: () => router.navigate(settings.href) }}
		/>
	);
}
