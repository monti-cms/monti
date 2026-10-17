"use client";

import { useSite } from "@monti-cms/core/site";
import { type ReactNode, useMemo } from "react";
import { AdminComponentsProvider } from "../admin-components";
import { AdminEventsProvider } from "../events";
import type { LoadedAdminPlugin } from "../internal-plugins";
import type { AdminPlugin } from "../plugins";
import { SlotRegistryProvider } from "../slots/registry";

/** Applies one plugin's declaration around the admin: its `Provider` outside, then its `components`, its `on` and its `slots`. */
function PluginLayer({ plugin, children }: { readonly plugin: AdminPlugin; readonly children: ReactNode }) {
	const site = useSite();
	const { components, slots, Provider, on } = plugin;
	const resolved = useMemo(
		() => (typeof components === "function" ? components(site) : components),
		[components, site],
	);
	const events = useMemo(() => (typeof on === "function" ? on(site) : on), [on, site]);
	let inner = children;
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
	return plugins.reduceRight<ReactNode>(
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
}
