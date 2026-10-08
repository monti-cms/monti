import { type ReactNode } from "react";
/** localStorage key the admin theme is stored under. It differs from next-themes' default (`theme`), which sites use for their own theme. */
export declare const ADMIN_THEME_STORAGE_KEY = "monti-admin-theme";
/**
 * Theme provider for the admin UI (`next-themes`; puts the `dark` class and `color-scheme` on `html`).
 *
 * The admin keeps its theme under its own storage key (`storageKey`, default {@link ADMIN_THEME_STORAGE_KEY}), so switching it
 * does not change the site's theme. When leaving the admin (e.g. navigating to a public page that uses the same root layout),
 * it puts `html` back the way it was before the admin mounted, instead of clearing `dark`, `light` and `color-scheme`, which
 * would also strip what the site's own theme provider had set.
 */
export declare function AdminThemeProvider({ children, storageKey, }: {
    children: ReactNode;
    /** localStorage key for the admin theme. */
    storageKey?: string;
}): import("react").JSX.Element;
