"use client";

import { useSite } from "@monti-cms/core/site";
import { type ReactNode, useMemo } from "react";
import { AdminComponentsProvider } from "../admin-components";
import { AdminEventsProvider } from "../events";
import type { LoadedAdminPlugin } from "../internal-plugins";
import type { AdminPlugin } from "../plugins";
import { ScreenContextProvider } from "../screens/shared/screen-context";
import { AdminPanelProvider } from "../screens/shared/side-panel-slot";
import { StatusCellsProvider } from "../screens/shared/status-bar";
import { SlotRegistryProvider } from "../slots/registry";

/** Applies one plugin's declaration around the admin: its `Provider` outside, then its `components`, its `on`, its `statusCells`, its `panel` and its `slots`. */
function PluginLayer({ plugin, children }: { readonly plugin: AdminPlugin; readonly children: ReactNode }) {
	const site = useSite();
	const { components, slots, Provider, on, statusCells, panel } = plugin;
	const resolved = useMemo(
		() => (typeof components === "function" ? components(site) : components),
		[components, site],
	);
	const events = useMemo(() => (typeof on === "function" ? on(site) : on), [on, site]);
	const cells = useMemo(
		() => (typeof statusCells === "function" ? statusCells(site) : statusCells),
		[statusCells, site],
	);
	const resolvedPanel = useMemo(() => (typeof panel === "function" ? panel(site) : panel), [panel, site]);
	let inner = children;
	if (resolvedPanel) inner = <AdminPanelProvider panel={resolvedPanel}>{inner}</AdminPanelProvider>;
	if (cells) inner = <StatusCellsProvider cells={cells}>{inner}</StatusCellsProvider>;
	if (slots && slots.length > 0) inner = <SlotRegistryProvider sources={slots}>{inner}</SlotRegistryProvider>;
	if (events) inner = <AdminEventsProvider on={events}>{inner}</AdminEventsProvider>;
	if (resolved) inner = <AdminComponentsProvider components={resolved}>{inner}</AdminComponentsProvider>;
	return Provider ? <Provider>{inner}</Provider> : inner;
}

/**
 * The plugins' admin sides around the admin UI, in registration order (the first plugin outermost, so a later one's registration of the same name wins).
 * The host renders it on the server and the declarations are applied in the browser.
 */
export function AdminPluginScope({
	plugins,
	children,
}: {
	readonly plugins: readonly LoadedAdminPlugin[];
	readonly children: ReactNode;
}) {
	const layered = plugins.reduceRight<ReactNode>(
		(inner, { name, plugin }) =>
			plugin ? (
				<PluginLayer key={name} plugin={plugin}>
					{inner}
				</PluginLayer>
			) : (
				inner
			),
		children,
	);
	// Outside the plugins, so a plugin's panel and its providers read what the screens publish.
	return <ScreenContextProvider>{layered}</ScreenContextProvider>;
}
