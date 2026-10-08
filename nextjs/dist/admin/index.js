import { jsx as _jsx } from "react/jsx-runtime";
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
import { AdminLayout, AdminPage, adminMetadata, } from "@monti-cms/admin/host";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { assertCms } from "../assert-cms.js";
import { nextHost } from "../auth/host.js";
import { NextAdminRouter } from "./router.js";
export { NextAdminRouter };
/** Admin UI metadata of an instance. Use it in the app's admin layout: `export const generateMetadata = () => cmsAdminMetadata(cms);`. */
export const cmsAdminMetadata = (cms) => {
    assertCms(cms, "cmsAdminMetadata(cms)");
    cms.attachHost?.(nextHost);
    return adminMetadata(cms);
};
/**
 * Admin UI layout. Rendered by the app's `app/(admin)/admin/layout.tsx`. Styles: the app imports the prebuilt `@monti-cms/admin/styles.css` (and the plugins' `styles.css`) in this layout; no Tailwind is needed.
 * Supports both light and dark themes and, by default, renders the `next-themes` provider and the toast container.
 * If the site already has them, turn them off with `<CmsAdminLayout cms={cms} themeProvider={false} toaster={false}>`.
 *
 * The admin is a per-request app (the session, the database, the current time and the URL are all runtime data), so it is never prerendered. The layout waits for the request
 * (`connection()`) inside a `Suspense` boundary with no fallback, which is what Next's Cache Components (`cacheComponents: true`) asks of a route like this and changes nothing
 * without that option. The page and every client component below it render after the request is known, so none of them needs a boundary of its own.
 */
export function CmsAdminLayout(props) {
    assertCms(props.cms, "<CmsAdminLayout cms={cms}>");
    return (_jsx(Suspense, { fallback: null, children: _jsx(AdminShell, { ...props }) }));
}
async function AdminShell(props) {
    await connection();
    // The login reads the headers of the request through Next, so the site's config needs no `host`.
    props.cms.attachHost?.(nextHost);
    return (_jsx(NextAdminRouter, { children: _jsx(AdminLayout, { ...props }) }));
}
/**
 * A single admin screen. Rendered by the app's admin route (default `app/(admin)/admin/[[...path]]/page.tsx`). The path after the admin path
 * selects the screen.
 *
 * - `/admin` list · `/admin/trash` trash · `/admin/media` media · `/admin/templates` body templates · `/admin/schema` schema settings
 * - `/admin/entries/new` new entry · `/admin/entries/<id>/edit` edit · `/admin/login` login
 * - `/admin/<path>` plugin screens (e.g. the AI plugin's `/admin/ai`)
 */
export function CmsAdminPage({ cms, ...props }) {
    assertCms(cms, "<CmsAdminPage cms={cms}>");
    cms.attachHost?.(nextHost);
    return _jsx(AdminPage, { ...props, cms: cms, server: { redirect: (href) => redirect(href), notFound } });
}
