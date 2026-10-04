export interface CmsAdminPageProps {
    params: Promise<{
        path?: string[];
    }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}
/**
 * A single admin screen. Rendered by the app's admin route (default `app/(admin)/admin/[[...path]]/page.tsx`). The path after the admin path
 * selects the screen. The admin path is the site config's `admin.path` (default `/admin`) and must match the route folder.
 *
 * - `/admin` list · `/admin/trash` trash · `/admin/media` media · `/admin/templates` body templates
 * - `/admin/entries/new` new entry · `/admin/entries/<id>/edit` edit · `/admin/login` login
 * - `/admin/<path>` plugin screens (e.g. the AI plugin's `/admin/ai`)
 */
export declare function CmsAdminPage({ params, searchParams }: CmsAdminPageProps): Promise<import("react").JSX.Element>;
