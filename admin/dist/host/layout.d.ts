import type { Cms } from "@monti-cms/core/runtime";
import type { ReactNode } from "react";
/**
 * Metadata of the admin pages of an instance (title, no indexing), in the shape the framework's metadata export expects (Next's `Metadata` accepts it as is).
 * The title follows the site name and the admin language of the instance's site. A host package calls it from the admin layout's `generateMetadata`.
 */
export declare function adminMetadata(cms: Pick<Cms, "site">): {
    readonly title: string;
    readonly robots: {
        readonly index: false;
        readonly follow: false;
    };
};
export type AdminLayoutProps = {
    /** The CMS instance: the `cms` exported by the app's server file. */
    cms: Cms;
    children: ReactNode;
    /**
     * Whether to render the admin UI's theme provider (`next-themes`). Default `true`. Set `false` if the site already has a theme provider.
     * In that case the admin UI follows the `.dark` or `[data-theme="dark"]` the site puts on `html`.
     */
    themeProvider?: boolean;
    /**
     * localStorage key the admin UI's own theme is stored under. Default `monti-admin-theme`, so switching the admin theme does not change the site's theme.
     * Only used with `themeProvider`.
     */
    themeStorageKey?: string;
    /**
     * Whether to render the admin UI's toast container (`sonner`'s `Toaster`). Default `true`. Set `false` if the site already has a `Toaster`.
     * Admin UI toasts also appear in the site's `Toaster` (when using the same `sonner` package).
     */
    toaster?: boolean;
};
/**
 * Admin UI layout, framework-neutral. A host package renders it inside the router provider (`CmsAdminLayout` of `@monti-cms/nextjs/admin` for Next.js). Styles (Tailwind, `cms-*` colors) come from the app's global CSS.
 * Supports both light and dark themes and, by default, renders the `next-themes` provider and the toast container.
 * If the site already has them, turn them off with `<AdminLayout cms={cms} themeProvider={false} toaster={false}>`.
 */
export declare function AdminLayout({ cms, children, themeProvider, themeStorageKey, toaster, }: AdminLayoutProps): Promise<import("react").JSX.Element>;
