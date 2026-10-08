import type { Cms } from "@monti-cms/core/runtime";
import type { AdminServer } from "./server.js";
export interface AdminPageProps {
    params: Promise<{
        path?: string[];
    }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
    /** The CMS instance: the `cms` exported by the app's server file. */
    cms: Cms;
    /** What the framework does for a redirect and a 404 (see `AdminServer`). */
    server: AdminServer;
}
/**
 * A single admin screen, framework-neutral. A host package renders it from the app's admin route (default `app/(admin)/admin/[[...path]]/page.tsx`). The path after the admin path
 * selects the screen. The admin path is the site config's `admin.path` (default `/admin`) and must match the route folder.
 *
 * - `/admin` list · `/admin/trash` trash · `/admin/media` media · `/admin/templates` body templates · `/admin/events` failed event deliveries · `/admin/schema` schema settings
 * - `/admin/entries/new` new entry · `/admin/entries/<id>/edit` edit · `/admin/login` login
 * - `/admin/<path>` plugin screens (e.g. the AI plugin's `/admin/ai`)
 */
export declare function AdminPage({ cms, server, params, searchParams }: AdminPageProps): Promise<import("react").JSX.Element | undefined>;
