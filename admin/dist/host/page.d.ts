import type { Cms } from "@monti-cms/core/server";
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
 * - `/admin` list · `/admin/trash` trash · `/admin/media` media · `/admin/templates` body templates · `/admin/data` backup, import and restore · `/admin/events` event log ·
 *   `/admin/api-keys` API keys
 * - `/admin/settings/<tab>` Settings: `site`, `locales`, `collections`, `admin` (the schema file)
 * - `/admin/tools/<path>` Tools: one page per plugin `nav` item (e.g. the AI plugin's `/admin/tools/ai`)
 * - `/admin/entries/new` new entry · `/admin/entries/<id>/edit` edit · `/admin/login` login
 */
export declare function AdminPage({ cms, server, params, searchParams }: AdminPageProps): Promise<import("react").JSX.Element | undefined>;
