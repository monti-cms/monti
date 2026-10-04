"use client";

import { ThemeProvider } from "next-themes";
import { type ReactNode, useEffect } from "react";

/**
 * Theme provider for the admin UI (`next-themes`; puts the `dark` class and `color-scheme` on `html`).
 * When leaving the admin (e.g. navigating to a public page that uses the same root layout), it clears the values the provider left on `html`.
 * Without this, public pages would show a dark background with text colors meant for the light theme.
 */
export function AdminThemeProvider({ children }: { children: ReactNode }) {
	useEffect(() => {
		const root = document.documentElement;
		return () => {
			root.classList.remove("dark", "light");
			root.style.removeProperty("color-scheme");
		};
	}, []);
	return (
		<ThemeProvider attribute="class" disableTransitionOnChange>
			{children}
		</ThemeProvider>
	);
}
