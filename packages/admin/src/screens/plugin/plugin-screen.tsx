"use client";

import type { AdminPlugin } from "../../plugins";

/** A plugin's screen. The declaration is read here, in the browser: the server may only refer to a `"use client"` admin module. */
export function PluginScreenView({
	plugin,
	screen,
	params,
}: {
	readonly plugin: AdminPlugin;
	readonly screen: string;
	readonly params: readonly string[];
}) {
	const Screen = plugin.screens?.[screen];
	return Screen ? <Screen params={params} /> : null;
}
