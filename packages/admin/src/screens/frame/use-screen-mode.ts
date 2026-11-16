import { useEffect, useState, useSyncExternalStore } from "react";

export type ScreenMode = "system" | "light" | "dark";

const KEY = "monti.screenMode";

const stored = (): ScreenMode => {
	try {
		const value = localStorage.getItem(KEY);
		return value === "light" || value === "dark" ? value : "system";
	} catch {
		return "system";
	}
};

/** The screen mode is one thing for the whole page: read from this browser once, then shared by whoever asks (the switch in the sidebar) and applied by the root. */
let current: ScreenMode | null = null;
const listeners = new Set<() => void>();
const read = () => {
	current ??= stored();
	return current;
};
const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};
export const setScreenMode = (mode: ScreenMode) => {
	current = mode;
	try {
		localStorage.setItem(KEY, mode);
	} catch {}
	for (const listener of listeners) listener();
};

/** The screen mode, kept in this browser (doc 15), and how to change it. Reading it puts nothing on the page: {@link useApplyScreenMode} does, once, at the app root. */
export function useScreenMode() {
	const mode = useSyncExternalStore(subscribe, read, () => "system" as ScreenMode);
	return [mode, setScreenMode] as const;
}

/**
 * Puts the screen mode on the page as `data-theme` (`system` follows the system's own). It is called once, by the app root, so every screen has it, the
 * frame's and those drawn outside it (the editor, the login): a screen that is opened by its address or reloaded keeps its dark mode (TT-01).
 */
export function useApplyScreenMode() {
	const [mode] = useScreenMode();
	useEffect(() => {
		const dark = window.matchMedia("(prefers-color-scheme: dark)");
		const apply = () => {
			document.documentElement.dataset.theme = mode === "system" ? (dark.matches ? "dark" : "light") : mode;
		};
		apply();
		dark.addEventListener("change", apply);
		return () => dark.removeEventListener("change", apply);
	}, [mode]);
	// When the admin goes (a move from the admin to the site in the same page), its mode goes with it: the site's own blocks follow the site's mode.
	useEffect(
		() => () => {
			delete document.documentElement.dataset.theme;
		},
		[],
	);
}

const RAIL = "monti.sidebarRail";

/** Whether the sidebar is folded to a rail, kept in this browser (doc 15). Its width the sidebar keeps itself (`resizeKey`). */
export function useSidebarRail() {
	const [rail, setRail] = useState(() => {
		try {
			return localStorage.getItem(RAIL) === "true";
		} catch {
			return false;
		}
	});
	useEffect(() => {
		try {
			localStorage.setItem(RAIL, String(rail));
		} catch {}
	}, [rail]);
	return [rail, setRail] as const;
}
