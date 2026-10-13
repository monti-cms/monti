"use client";

import { useEffect, useRef } from "react";

/**
 * Cmd/Ctrl+S runs `onSave` instead of the browser's "save page". The latest `onSave` is always used, so it can close over current state.
 * Ignored while an IME composition is going on.
 */
export function useSaveShortcut(onSave: () => void, enabled = true): void {
	const saveRef = useRef(onSave);
	saveRef.current = onSave;
	useEffect(() => {
		if (!enabled) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (!(event.metaKey || event.ctrlKey) || event.altKey || event.isComposing) return;
			if (event.key.toLowerCase() !== "s") return;
			event.preventDefault();
			saveRef.current();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [enabled]);
}
