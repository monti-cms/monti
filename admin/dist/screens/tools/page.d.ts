import type { Cms } from "@monti-cms/core/runtime";
import type { AdminServer } from "../../host/server.js";
/**
 * `<admin path>/tools/<path>`: the page of a plugin `nav` item, drawn by the plugin's `pages` entry and framed by the admin (sidebar, title).
 * An unknown path is a 404.
 */
export default function AdminToolsPage({ cms, server, path }: {
    cms: Cms;
    server: AdminServer;
    path: string;
}): Promise<import("react").JSX.Element>;
