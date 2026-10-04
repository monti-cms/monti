"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { ThemeProvider } from "next-themes";
import { useEffect } from "react";
/**
 * Theme provider for the admin UI (`next-themes`; puts the `dark` class and `color-scheme` on `html`).
 * When leaving the admin (e.g. navigating to a public page that uses the same root layout), it clears the values the provider left on `html`.
 * Without this, public pages would show a dark background with text colors meant for the light theme.
 */
export function AdminThemeProvider({ children }) {
    useEffect(() => {
        const root = document.documentElement;
        return () => {
            root.classList.remove("dark", "light");
            root.style.removeProperty("color-scheme");
        };
    }, []);
    return (_jsx(ThemeProvider, { attribute: "class", disableTransitionOnChange: true, children: children }));
}
