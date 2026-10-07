"use client";

import { ThemeProvider } from "next-themes";
import { type ReactNode, useEffect, useRef } from "react";

/** localStorage key the admin theme is stored under. It differs from next-themes' default (`theme`), which sites use for their own theme. */
export const ADMIN_THEME_STORAGE_KEY = "monti-admin-theme";

/** What the admin provider needs to give back to `html`: the theme markers that were there before the admin touched them. */
type HtmlThemeState = { dark: boolean; light: boolean; colorScheme: string };

/** Window property the inline script below leaves the pre-admin state in, for a page that was loaded straight into the admin. */
const BEFORE_KEY = "__montiAdminHtmlBefore";

const readHtmlThemeState = (): HtmlThemeState => {
	const root = document.documentElement;
	return {
		dark: root.classList.contains("dark"),
		light: root.classList.contains("light"),
		colorScheme: root.style.colorScheme,
	};
};

/**
 * Runs in the server HTML before the `next-themes` script of this provider, i.e. before the admin theme lands on `html`.
 * On a full page load that is the only moment the site's own theme (put there by the site's provider) can still be seen.
 */
const CAPTURE_SCRIPT = `(function(){var r=document.documentElement;window.${BEFORE_KEY}={dark:r.classList.contains("dark"),light:r.classList.contains("light"),colorScheme:r.style.colorScheme};})();`;

const restoreHtmlThemeState = (before: HtmlThemeState) => {
	const root = document.documentElement;
	root.classList.toggle("dark", before.dark);
	root.classList.toggle("light", before.light);
	if (before.colorScheme) root.style.colorScheme = before.colorScheme;
	else root.style.removeProperty("color-scheme");
	if (root.classList.length === 0) root.removeAttribute("class");
	if (root.getAttribute("style") === "") root.removeAttribute("style");
};

/**
 * Theme provider for the admin UI (`next-themes`; puts the `dark` class and `color-scheme` on `html`).
 *
 * The admin keeps its theme under its own storage key (`storageKey`, default {@link ADMIN_THEME_STORAGE_KEY}), so switching it
 * does not change the site's theme. When leaving the admin (e.g. navigating to a public page that uses the same root layout),
 * it puts `html` back the way it was before the admin mounted, instead of clearing `dark`, `light` and `color-scheme`, which
 * would also strip what the site's own theme provider had set.
 */
export function AdminThemeProvider({
	children,
	storageKey = ADMIN_THEME_STORAGE_KEY,
}: {
	children: ReactNode;
	/** localStorage key for the admin theme. */
	storageKey?: string;
}) {
	// Read during the first render, before the theme provider's effects apply the admin theme.
	// The server script's value wins (it was taken before the admin's theme script ran); the live `html` is the state after a client navigation.
	const before = useRef<HtmlThemeState | null>(null);
	if (before.current === null && typeof document !== "undefined") {
		before.current =
			(window as unknown as Record<string, HtmlThemeState | undefined>)[BEFORE_KEY] ?? readHtmlThemeState();
	}
	useEffect(() => {
		return () => {
			if (before.current) restoreHtmlThemeState(before.current);
			delete (window as unknown as Record<string, unknown>)[BEFORE_KEY];
		};
	}, []);
	return (
		<>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed string with no input */}
			<script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CAPTURE_SCRIPT }} />
			<ThemeProvider attribute="class" storageKey={storageKey} disableTransitionOnChange>
				{children}
			</ThemeProvider>
		</>
	);
}
