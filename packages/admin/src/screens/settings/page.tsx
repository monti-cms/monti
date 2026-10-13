import type { Cms } from "@monti-cms/core/runtime";
import type { AdminServer } from "../../host/server";
import { loadAdminPlugins } from "../../plugins";
import { requireAdminPage } from "../require-admin";
import { SettingsScreen } from "./settings-screen";
import { CORE_TABS, coreTabEnabled } from "./tabs";

/**
 * `<admin path>/settings/<tab>`. A core tab is drawn by the Settings screen; a plugin tab is the plugin's `pages` entry, passed in as its content.
 * `/settings` alone goes to the first tab. An unknown tab (or Templates when the site turned them off) is a 404.
 */
export default async function AdminSettingsPage({
	cms,
	server,
	tab,
}: {
	cms: Cms;
	server: AdminServer;
	tab: string | undefined;
}) {
	await requireAdminPage(cms, server);
	if (tab === undefined) return server.redirect(cms.site.adminHref(`/settings/${CORE_TABS[0]}`));
	const core = CORE_TABS.find((id) => id === tab);
	if (core) {
		if (!coreTabEnabled(cms.site, core)) server.notFound();
		return <SettingsScreen tab={core} />;
	}
	const Page = (await loadAdminPlugins(cms.site)).find((plugin) => plugin.pages?.[tab])?.pages?.[tab];
	if (!Page) return server.notFound();
	return (
		<SettingsScreen tab={tab}>
			<Page />
		</SettingsScreen>
	);
}
