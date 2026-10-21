import type { Cms } from "@monti-cms/core/server";
import type { AdminServer } from "../../host/server.js";
/**
 * `<admin path>/settings/<tab>`: one of the tabs (the schema file's `site`, `locales`, `collections` and `admin`).
 * `/settings/data` is the Data page (a page of its own, not part of the schema file). `/settings` alone goes to the first tab. An unknown tab is a 404.
 */
export default function AdminSettingsPage({ cms, server, tab, }: {
    cms: Cms;
    server: AdminServer;
    tab: string | undefined;
}): Promise<import("react").JSX.Element>;
