"use client";

import { useSyncExternalStore } from "react";

/**
 * One key of a shortcut. `mod` is ⌘ on a Mac and Ctrl elsewhere; `shift` and `alt` are the other modifiers. Any other key is itself: a letter
 * ("S"), or a key name ("ArrowUp", "ArrowDown", "Backspace", "Enter", "Delete", "Escape").
 */
export type ShortcutKey = "mod" | "shift" | "alt" | (string & {});

/** A shortcut as its keys, modifiers first (`["mod", "shift", "D"]`). It is written for the system the admin runs on (`useShortcut`). */
export type ShortcutKeys = readonly ShortcutKey[];

const MAC: Readonly<Record<string, string>> = {
	mod: "⌘",
	shift: "⇧",
	alt: "⌥",
	ArrowUp: "↑",
	ArrowDown: "↓",
	ArrowLeft: "←",
	ArrowRight: "→",
	Backspace: "⌫",
	Delete: "⌦",
	Enter: "↵",
	Escape: "⎋",
};
const OTHER: Readonly<Record<string, string>> = {
	mod: "Ctrl",
	shift: "Shift",
	alt: "Alt",
	ArrowUp: "↑",
	ArrowDown: "↓",
	ArrowLeft: "←",
	ArrowRight: "→",
	Backspace: "Backspace",
	Delete: "Del",
	Enter: "Enter",
	Escape: "Esc",
};
/** A Mac writes its modifiers in the order ⌥⇧⌘ before the key; Windows and Linux write Ctrl+Alt+Shift+key. */
const MAC_ORDER = ["alt", "shift", "mod"];
const OTHER_ORDER = ["mod", "alt", "shift"];

/** The shortcut as a Mac writes it ("⇧⌘D", glyphs with no separator) or as Windows and Linux do ("Ctrl+Shift+D"). */
export function formatShortcut(keys: ShortcutKeys, mac: boolean): string {
	const names = mac ? MAC : OTHER;
	const order = mac ? MAC_ORDER : OTHER_ORDER;
	const modifiers = order.filter((modifier) => keys.includes(modifier));
	const rest = keys.filter((key) => !order.includes(key));
	const written = [...modifiers, ...rest].map((key) => names[key] ?? (key.length === 1 ? key.toUpperCase() : key));
	return written.join(mac ? "" : "+");
}

/** Whether the admin runs on Apple's systems, where the shortcut modifier is ⌘ rather than Ctrl. */
const isApple = () => {
	const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
	return /mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform || nav.platform || "");
};
const noSubscribe = () => () => {};

/**
 * The shortcut written for this system: "⌘S" on a Mac, "Ctrl+S" on Windows and Linux. The server and the first render use the Ctrl form; a Mac
 * switches to its glyphs right after.
 */
export function useShortcut(keys: ShortcutKeys): string {
	const mac = useSyncExternalStore(noSubscribe, isApple, () => false);
	return formatShortcut(keys, mac);
}

/** A shortcut as text, for a part that shows one in its own type (a menu row, a button). */
export function Shortcut({ keys }: { keys: ShortcutKeys }) {
	return <>{useShortcut(keys)}</>;
}
