import type { Cms } from "@monti-cms/core/server";
import type { AdminServer } from "../../host/server";
import { loadAdminPlugins } from "../../internal-plugins";
import { ApiKeysSettings } from "../api-keys/api-keys-settings";
import { DataScreen } from "../data/data-screen";
import { EventsScreen } from "../events/events-screen";
import { requireAdminPage } from "../require-admin";
import { TemplateManager } from "../templates/template-manager";
import { PluginToolPage } from "./plugin-page";
import { toolsHref, toolsTabs } from "./tools-tabs";

/**
 * `<admin path>/tools/<path>`: the tools page, one tab per address: `templates` (a 404 when the site turns templates off), `data`, `events`,
 * `api-keys`, and a plugin's page for a path its `nav` item names. `/tools` alone goes to the first tab. Any other path is a 404.
 */
export default async function AdminToolsPage({
	cms,
	server,
	path,
}: {
	cms: Cms;
	server: AdminServer;
	path: string | undefined;
}) {
	await requireAdminPage(cms, server);
	if (path === undefined) return server.redirect(toolsHref(cms.site));
	const tab = toolsTabs(cms.site).find((entry) => entry.path === path);
	if (!tab) return server.notFound();
	switch (tab.id) {
		case "templates":
			return <TemplateManager />;
		case "data":
			return <DataScreen />;
		case "events":
			return <EventsScreen />;
		case "api-keys":
			return <ApiKeysSettings />;
		default: {
			const owner = (await loadAdminPlugins(cms.site)).find((plugin) => plugin.name === tab.plugin);
			return <PluginToolPage tab={tab} plugin={owner?.plugin} />;
		}
	}
}
