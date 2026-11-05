import { useEffect, useState } from "react";

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

/** The screen mode, kept in this browser (doc 15), put on the page as `data-theme` (`system` follows the system's own). */
export function useScreenMode() {
	const [mode, setMode] = useState<ScreenMode>(stored);
	useEffect(() => {
		const dark = window.matchMedia("(prefers-color-scheme: dark)");
		const apply = () => {
			document.documentElement.dataset.theme = mode === "system" ? (dark.matches ? "dark" : "light") : mode;
		};
		apply();
		try {
			localStorage.setItem(KEY, mode);
		} catch {}
		dark.addEventListener("change", apply);
		return () => dark.removeEventListener("change", apply);
	}, [mode]);
	return [mode, setMode] as const;
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
