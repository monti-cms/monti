/**
 * The screen mode's one source (doc 15): the key it is kept under in the browser, how it is read, and how it becomes the page's `data-theme`. It holds no
 * React, so a server page can import it: `screenModeScript()` is the script the admin's page puts before its content, which sets the attribute before the
 * first paint from the very functions the admin's own hook (`use-screen-mode.ts`) uses afterwards. `storedScreenMode` and `applyScreenMode` are written to
 * stand alone (they name nothing outside themselves), because the script is their source text.
 */
export type ScreenMode = "system" | "light" | "dark";

/** The key the mode is kept under in this browser. */
export const SCREEN_MODE_KEY = "monti.screenMode";

/** The mode kept under `key`: `light` or `dark`, and `system` when nothing, or something else, is kept (or the browser keeps nothing). */
export function storedScreenMode(key: string): ScreenMode {
	try {
		const value = localStorage.getItem(key);
		return value === "light" || value === "dark" ? value : "system";
	} catch {
		return "system";
	}
}

/** Puts the mode on the page as `data-theme`: `system` follows the system's own. */
export function applyScreenMode(mode: ScreenMode) {
	const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	document.documentElement.dataset.theme = mode === "system" ? (dark ? "dark" : "light") : mode;
}

/**
 * A script that sets the page's mode before the page paints: the stored mode, or the system's. The admin's page puts it first, so its first frame has
 * the right mode and a dark user sees no light one. It is the two functions above as text, with the key.
 */
export function screenModeScript() {
	return `try{(${applyScreenMode.toString()})((${storedScreenMode.toString()})(${JSON.stringify(SCREEN_MODE_KEY)}))}catch(e){}`;
}
