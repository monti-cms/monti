import type { Metadata } from "next";
import type { ReactNode } from "react";
/** Admin UI metadata. Use it in the app's admin layout as `export const metadata = cmsAdminMetadata;`. */
export declare const cmsAdminMetadata: Metadata;
export type CmsAdminLayoutProps = {
    children: ReactNode;
    /**
     * Whether to render the admin UI's theme provider (`next-themes`). Default `true`. Set `false` if the site already has a theme provider.
     * In that case the admin UI follows the `.dark` or `[data-theme="dark"]` the site puts on `html`.
     */
    themeProvider?: boolean;
    /**
     * Whether to render the admin UI's toast container (`sonner`'s `Toaster`). Default `true`. Set `false` if the site already has a `Toaster`.
     * Admin UI toasts also appear in the site's `Toaster` (when using the same `sonner` package).
     */
    toaster?: boolean;
};
/**
 * Admin UI layout. Rendered by the app's `app/(admin)/admin/layout.tsx`. Styles (Tailwind, `cms-*` colors) come from the app's global CSS.
 * Supports both light and dark themes and, by default, renders the `next-themes` provider and the toast container.
 * If the site already has them, turn them off with `<CmsAdminLayout themeProvider={false} toaster={false}>`.
 */
export declare function CmsAdminLayout({ children, themeProvider, toaster }: CmsAdminLayoutProps): Promise<import("react").JSX.Element>;
