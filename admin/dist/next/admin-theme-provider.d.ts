import { type ReactNode } from "react";
/**
 * Theme provider for the admin UI (`next-themes`; puts the `dark` class and `color-scheme` on `html`).
 * When leaving the admin (e.g. navigating to a public page that uses the same root layout), it clears the values the provider left on `html`.
 * Without this, public pages would show a dark background with text colors meant for the light theme.
 */
export declare function AdminThemeProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
