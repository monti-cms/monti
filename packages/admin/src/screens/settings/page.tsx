import type { Cms } from "@monti-cms/core/runtime";
import type { AdminServer } from "../../host/server";
import { requireAdminPage } from "../require-admin";
import { SettingsScreen } from "./settings-screen";
import { isSettingsTab, SETTINGS_TABS } from "./tabs";

/**
 * `<admin path>/settings/<tab>`: one of the tabs (the schema file's `site`, `locales`, `collections`, `file`, and `admin`).
 * `/settings` alone goes to the first tab. An unknown tab is a 404.
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
	if (tab === undefined) return server.redirect(cms.site.adminHref(`/settings/${SETTINGS_TABS[0]}`));
	if (!isSettingsTab(tab)) return server.notFound();
	return <SettingsScreen tab={tab} />;
}
