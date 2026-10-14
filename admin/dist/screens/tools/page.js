import { jsx as _jsx } from "react/jsx-runtime";
import { loadAdminPlugins } from "../../plugins.js";
import { requireAdminPage } from "../require-admin.js";
import { ShellPage } from "../shared/admin-shell.js";
import { toolsPages } from "./tools-pages.js";
/**
 * `<admin path>/tools/<path>`: the page of a plugin `nav` item, drawn by the plugin's `pages` entry and framed by the admin (sidebar, title).
 * An unknown path is a 404.
 */
export default async function AdminToolsPage({ cms, server, path }) {
    await requireAdminPage(cms, server);
    const entry = toolsPages(cms.site).find((page) => page.path === path);
    const Page = (await loadAdminPlugins(cms.site)).find((plugin) => plugin.pages?.[path])?.pages?.[path];
    if (!entry || !Page)
        return server.notFound();
    return (_jsx(ShellPage, { title: entry.label, nav: `tools:${path}`, children: _jsx(Page, {}) }));
}
