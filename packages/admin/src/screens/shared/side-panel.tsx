"use client";

import type { ReactNode } from "react";

/**
 * Where the panel opened beside a list (a record, a media file, an activity) sits: on a wide screen it is a column beside the list, on a narrower one it
 * floats over the list's right edge. The panel inside (`SidePanel`) has its own fixed width.
 */
const SIDE_PANEL_DOCK =
	"absolute inset-y-0 right-0 z-20 flex max-w-full shadow-monti-floating lg:relative lg:shrink-0 lg:shadow-none";

/** The slot beside a list that the panel is put in. */
export function DockedPanel({ children }: { children: ReactNode }) {
	return <div className={SIDE_PANEL_DOCK}>{children}</div>;
}

/** The slot of the plugin's panel: a column beside the page on a wide window, floating over its right edge on a narrow one. */
export function PluginPanelSlot({ overlay, children }: { overlay: boolean; children: ReactNode }) {
	return (
		<div
			className={overlay ? "fixed inset-y-0 right-0 z-30 flex w-full shadow-monti-floating sm:w-auto" : "flex shrink-0"}
		>
			{children}
		</div>
	);
}
