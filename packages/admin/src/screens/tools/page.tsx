import type { Cms } from "@monti-cms/core/server";
import type { AdminServer } from "../../host/server";
import { loadAdminPlugins } from "../../internal-plugins";
import { requireAdminPage } from "../require-admin";
import { ShellPage } from "../shared/admin-shell";
import { PluginToolPage } from "./plugin-page";
import { toolsPages } from "./tools-pages";

/**
 * `<admin path>/tools/<path>`: the page of a plugin `nav` item, drawn by the plugin's `pages` entry and framed by the admin (sidebar, title).
 * A path no `nav` item has is a 404; a `nav` item whose plugin has no page for it says so.
 */
export default async function AdminToolsPage({ cms, server, path }: { cms: Cms; server: AdminServer; path: string }) {
	await requireAdminPage(cms, server);
	const entry = toolsPages(cms.site).find((page) => page.path === path);
	if (!entry) return server.notFound();
	const owner = (await loadAdminPlugins(cms.site)).find((plugin) => plugin.name === entry.plugin);
	return (
		<ShellPage title={entry.label} nav={`tools:${path}`}>
			<PluginToolPage plugin={owner?.plugin} name={entry.plugin} path={path} />
		</ShellPage>
	);
}
