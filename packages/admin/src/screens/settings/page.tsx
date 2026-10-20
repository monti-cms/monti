import type { Cms } from "@monti-cms/core/server";
import type { AdminServer } from "../../host/server";
import { requireAdminPage } from "../require-admin";
import { DataScreen } from "./data-screen";
import { SettingsScreen } from "./settings-screen";
import { DATA_TAB, isSchemaTab, SCHEMA_TABS } from "./tabs";

/**
 * `<admin path>/settings/<tab>`: one of the tabs (the schema file's `site`, `locales`, `collections` and `admin`).
 * `/settings/data` is the Data page (a page of its own, not part of the schema file). `/settings` alone goes to the first tab. An unknown tab is a 404.
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
	if (tab === undefined) return server.redirect(cms.site.adminHref(`/settings/${SCHEMA_TABS[0]}`));
	if (tab === DATA_TAB) return <DataScreen />;
	if (!isSchemaTab(tab)) return server.notFound();
	return <SettingsScreen tab={tab} />;
}
