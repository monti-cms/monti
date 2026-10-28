"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePanelDock } from "./panel-dock";

/**
 * Where the panel opened beside a page (a record, a media file, an activity) sits: at the window's right edge, full height, beside the whole page; the
 * page then centres in the room that is left. On a narrower window it floats over the right edge instead. The panel inside (`SidePanel`) has its own
 * fixed width.
 */
const SIDE_PANEL_DOCK =
	"fixed inset-y-0 right-0 z-20 flex max-w-full shadow-monti-floating lg:static lg:shrink-0 lg:shadow-none";

/**
 * The slot a panel is put in. It is drawn in the dock of the admin frame, wherever the screen that opens it is in the page; outside a frame it stays
 * where it is written.
 */
export function DockedPanel({ children }: { children: ReactNode }) {
	const dock = usePanelDock();
	const slot = <div className={SIDE_PANEL_DOCK}>{children}</div>;
	if (dock === undefined) return slot;
	return dock ? createPortal(slot, dock) : null;
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
