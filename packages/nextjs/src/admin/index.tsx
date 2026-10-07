/**
 * Attaches the admin UI to a Next.js App Router app (server components). The layout and the page are the framework-neutral ones of
 * `@monti-cms/admin/host`, given Next's router (`NextAdminRouter`), `redirect` and `notFound`.
 *
 * ```tsx
 * // app/(admin)/admin/layout.tsx
 * import { CmsAdminLayout } from "@monti-cms/nextjs/admin";
 * export { cmsAdminMetadata as metadata } from "@monti-cms/nextjs/admin";
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
 * `cms` is the instance the app's server file exports. The admin path is the site config's `admin.path` (default `/admin`) and must match the route folder.
 */
import {
	AdminLayout,
	type AdminLayoutProps,
	AdminPage,
	type AdminPageProps,
	adminMetadata,
} from "@monti-cms/admin/host";
import type { Cms } from "@monti-cms/core/runtime";
import type { Metadata, Route } from "next";
import { notFound, redirect } from "next/navigation";
import { NextAdminRouter } from "./router";

export { NextAdminRouter };

/** Admin UI metadata. Use it in the app's admin layout as `export const metadata = cmsAdminMetadata;`. */
export const cmsAdminMetadata: Metadata = adminMetadata;

export type CmsAdminLayoutProps = AdminLayoutProps;

/**
 * Admin UI layout. Rendered by the app's `app/(admin)/admin/layout.tsx`. Styles: the app imports the prebuilt `@monti-cms/admin/styles.css` (and the plugins' `styles.css`) in this layout; no Tailwind is needed.
 * Supports both light and dark themes and, by default, renders the `next-themes` provider and the toast container.
 * If the site already has them, turn them off with `<CmsAdminLayout cms={cms} themeProvider={false} toaster={false}>`.
 */
export function CmsAdminLayout(props: CmsAdminLayoutProps) {
	return (
		<NextAdminRouter>
			<AdminLayout {...props} />
		</NextAdminRouter>
	);
}

export type CmsAdminPageProps = Pick<AdminPageProps, "params" | "searchParams">;

/**
 * A single admin screen. Rendered by the app's admin route (default `app/(admin)/admin/[[...path]]/page.tsx`). The path after the admin path
 * selects the screen.
 *
 * - `/admin` list · `/admin/trash` trash · `/admin/media` media · `/admin/templates` body templates
 * - `/admin/entries/new` new entry · `/admin/entries/<id>/edit` edit · `/admin/login` login
 * - `/admin/<path>` plugin screens (e.g. the AI plugin's `/admin/ai`)
 */
export function CmsAdminPage({ cms, ...props }: CmsAdminPageProps & { cms: Cms }) {
	return <AdminPage {...props} cms={cms} server={{ redirect: (href) => redirect(href as Route), notFound }} />;
}
