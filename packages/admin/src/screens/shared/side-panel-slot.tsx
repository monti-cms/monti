"use client";

// The side panel a plugin adds to the admin (`defineAdminPlugin({ panel })`): a button in the shell header, a pane on the right (floating over
// the page on narrow screens) and a shortcut. The admin shell and the entry editor shell both render it; open or closed is remembered in this browser.

import { useTranslator } from "@monti-cms/core/site";
import { IconButton } from "@monti-cms/ui";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react";
import { booleanCodec, usePreference } from "../../lib/hooks/use-preference";
import type { AdminPanel } from "../../plugins";
import { PluginPanelSlot } from "./side-panel";
import { sidePanelSlotMessages } from "./side-panel-slot.messages";

interface AdminPanelState {
	readonly panel: AdminPanel;
	/** Whether the sheet is open on a narrow screen. Held here, so the button and the pane agree. */
	readonly sheetOpen: boolean;
	readonly setSheetOpen: (open: boolean) => void;
}

const AdminPanelContext = createContext<AdminPanelState | null>(null);

/** Gives the screens the panel a plugin declared. With several, the innermost provider (the plugin registered last) wins. */
export function AdminPanelProvider({ panel, children }: { panel: AdminPanel; children: ReactNode }) {
	const [sheetOpen, setSheetOpen] = useState(false);
	const value = useMemo(() => ({ panel, sheetOpen, setSheetOpen }), [panel, sheetOpen]);
	return <AdminPanelContext.Provider value={value}>{children}</AdminPanelContext.Provider>;
}

/**
 * Below this width the panel floats over the screen. Docked, it would leave the page (beside the sidebar and the panel) too little room.
 */
const NARROW_QUERY = "(max-width: 1279px)";

const subscribeNarrow = (listener: () => void) => {
	const media = window.matchMedia?.(NARROW_QUERY);
	media?.addEventListener?.("change", listener);
	return () => media?.removeEventListener?.("change", listener);
};
const readNarrow = () => window.matchMedia?.(NARROW_QUERY).matches ?? false;

/** Whether the window is narrow enough for the panel to be a sheet. */
function useNarrow(): boolean {
	return useSyncExternalStore(subscribeNarrow, readNarrow, () => false);
}

export interface SidePanel {
	readonly panel: AdminPanel;
	readonly open: boolean;
	readonly narrow: boolean;
	readonly setOpen: (open: boolean) => void;
	readonly toggle: () => void;
}

/**
 * The panel of the plugin and whether it is open, or `null` when no plugin has one. On a wide screen the state is remembered in this browser; a sheet
 * on a narrow screen is opened by the person each time, so a remembered open panel never covers the screen on load.
 */
export function useSidePanel(): SidePanel | null {
	const state = useContext(AdminPanelContext);
	const [remembered, remember] = usePreference("side-panel", booleanCodec, false);
	const narrow = useNarrow();
	const setSheetOpen = state?.setSheetOpen;
	const open = narrow ? (state?.sheetOpen ?? false) : remembered;
	const setOpen = useCallback(
		(next: boolean) => (narrow ? setSheetOpen?.(next) : remember(next)),
		[narrow, setSheetOpen, remember],
	);
	const toggle = useCallback(() => setOpen(!open), [open, setOpen]);
	return state ? { panel: state.panel, open, narrow, setOpen, toggle } : null;
}

/** Ctrl or Cmd with `.` opens and closes the panel. */
export const SIDE_PANEL_SHORTCUT_KEY = ".";

/** The button of the shell header that opens and closes the panel; it also takes the shortcut. Nothing when no plugin has a panel. */
export function SidePanelToggle() {
	const side = useSidePanel();
	const t = useTranslator(sidePanelSlotMessages);
	const toggle = side?.toggle;
	useEffect(() => {
		if (!toggle) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.isComposing) return;
			if (event.key !== SIDE_PANEL_SHORTCUT_KEY) return;
			event.preventDefault();
			toggle();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [toggle]);
	if (!side) return null;
	const { label, icon: Icon } = side.panel;
	return (
		<IconButton
			label={side.open ? t("close", { label }) : t("open", { label })}
			side="bottom"
			pressed={side.open}
			onClick={side.toggle}
		>
			<Icon aria-hidden />
		</IconButton>
	);
}

/**
 * The open panel beside the screen: a column on a wide screen, floating over the page's right edge on a narrow one. Nothing while it is closed. The
 * component draws the panel itself (`SidePanel`), at the width it wants.
 */
export function SidePanelPane() {
	const side = useSidePanel();
	if (!side?.open) return null;
	const { Component } = side.panel;
	return (
		<PluginPanelSlot overlay={side.narrow}>
			<Component onClose={() => side.setOpen(false)} />
		</PluginPanelSlot>
	);
}
