/**
 * Attaches the admin UI to a Next.js App Router app (server components). The layout and the page are the framework-neutral ones of
 * `@monti-cms/admin/host`, given Next's router (`NextAdminRouter`), `redirect` and `notFound`.
 *
 * ```tsx
 * // app/(admin)/admin/layout.tsx
 * import { CmsAdminLayout, cmsAdminMetadata } from "@monti-cms/nextjs/admin";
 * export const generateMetadata = () => cmsAdminMetadata(cms);
 * export default function AdminLayout({ children }: { children: React.ReactNode }) {
 *   return <CmsAdminLayout cms={cms}>{children}</CmsAdminLayout>;
 * }
 *
 * // app/(admin)/admin/[[...path]]/page.tsx
 * import { CmsAdminPage, type CmsAdminPageProps } from "@monti-cms/nextjs/admin";
 * export default function Page(props: CmsAdminPageProps) {
 *   return <CmsAdminPage cms={cms} {...props} />;
 * }
 * ```
 *
 * `cms` is the instance the app's server file exports. The layout hands its site to the admin UI as data (collections, locales, blocks, addresses and admin language;
 * see `Site.snapshot()`), so the browser never loads the config file. The admin path is the site config's `admin.path` (default `/admin`) and must match the route folder.
 */
import { type AdminLayoutProps, type AdminPageProps } from "@monti-cms/admin/host";
import type { Cms } from "@monti-cms/core/runtime";
import type { Metadata } from "next";
import { NextAdminRouter } from "./router.js";
export { NextAdminRouter };
/** Admin UI metadata of an instance. Use it in the app's admin layout: `export const generateMetadata = () => cmsAdminMetadata(cms);`. */
export declare const cmsAdminMetadata: (cms: Pick<Cms, "site"> & Partial<Pick<Cms, "attachHost">>) => Metadata;
export type CmsAdminLayoutProps = AdminLayoutProps;
/**
 * Admin UI layout. Rendered by the app's `app/(admin)/admin/layout.tsx`. Styles: the app imports the prebuilt `@monti-cms/admin/styles.css` (and the plugins' `styles.css`) in this layout; no Tailwind is needed.
 * Supports both light and dark themes and, by default, renders the `next-themes` provider and the toast container.
 * If the site already has them, turn them off with `<CmsAdminLayout cms={cms} themeProvider={false} toaster={false}>`.
 *
 * The admin is a per-request app (the session, the database, the current time and the URL are all runtime data), so it is never prerendered. The layout waits for the request
 * (`connection()`) inside a `Suspense` boundary with no fallback, which is what Next's Cache Components (`cacheComponents: true`) asks of a route like this and changes nothing
 * without that option. The page and every client component below it render after the request is known, so none of them needs a boundary of its own.
 */
export declare function CmsAdminLayout(props: CmsAdminLayoutProps): import("react").JSX.Element;
export type CmsAdminPageProps = Pick<AdminPageProps, "params" | "searchParams">;
/**
 * A single admin screen. Rendered by the app's admin route (default `app/(admin)/admin/[[...path]]/page.tsx`). The path after the admin path
 * selects the screen.
 *
 * - `/admin` list · `/admin/trash` trash · `/admin/media` media · `/admin/templates` body templates · `/admin/schema` schema settings
 * - `/admin/entries/new` new entry · `/admin/entries/<id>/edit` edit · `/admin/login` login
 * - `/admin/<path>` plugin screens (e.g. the AI plugin's `/admin/ai`)
 */
export declare function CmsAdminPage({ cms, ...props }: CmsAdminPageProps & {
    cms: Cms;
}): import("react").JSX.Element;
