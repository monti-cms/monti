import type { Cms } from "@monti-cms/core/server";
import type { AdminServer } from "../../host/server.js";
/**
 * `<admin path>/tools/<path>`: the page of a plugin `nav` item, drawn by the plugin's `pages` entry and framed by the admin (sidebar, title).
 * A path no `nav` item has is a 404; a `nav` item whose plugin has no page for it says so.
 */
export default function AdminToolsPage({ cms, server, path }: {
    cms: Cms;
    server: AdminServer;
    path: string;
}): Promise<import("react").JSX.Element>;
