import { jsx as _jsx } from "react/jsx-runtime";
import { loadAdminPlugins } from "../../internal-plugins.js";
import { requireAdminPage } from "../require-admin.js";
import { ShellPage } from "../shared/admin-shell.js";
import { PluginToolPage } from "./plugin-page.js";
import { toolsPages } from "./tools-pages.js";
/**
 * `<admin path>/tools/<path>`: the page of a plugin `nav` item, drawn by the plugin's `pages` entry and framed by the admin (sidebar, title).
 * A path no `nav` item has is a 404; a `nav` item whose plugin has no page for it says so.
 */
export default async function AdminToolsPage({ cms, server, path }) {
    await requireAdminPage(cms, server);
    const entry = toolsPages(cms.site).find((page) => page.path === path);
    if (!entry)
        return server.notFound();
    const owner = (await loadAdminPlugins(cms.site)).find((plugin) => plugin.name === entry.plugin);
    return (_jsx(ShellPage, { title: entry.label, nav: `tools:${path}`, children: _jsx(PluginToolPage, { plugin: owner?.plugin, name: entry.plugin, path: path }) }));
}
