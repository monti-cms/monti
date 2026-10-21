import { jsx as _jsx } from "react/jsx-runtime";
import { requireAdminPage } from "../require-admin.js";
import { DataScreen } from "./data-screen.js";
import { SettingsScreen } from "./settings-screen.js";
import { DATA_TAB, isSchemaTab, SCHEMA_TABS } from "./tabs.js";
/**
 * `<admin path>/settings/<tab>`: one of the tabs (the schema file's `site`, `locales`, `collections` and `admin`).
 * `/settings/data` is the Data page (a page of its own, not part of the schema file). `/settings` alone goes to the first tab. An unknown tab is a 404.
 */
export default async function AdminSettingsPage({ cms, server, tab, }) {
    await requireAdminPage(cms, server);
    if (tab === undefined)
        return server.redirect(cms.site.adminHref(`/settings/${SCHEMA_TABS[0]}`));
    if (tab === DATA_TAB)
        return _jsx(DataScreen, {});
    if (!isSchemaTab(tab))
        return server.notFound();
    return _jsx(SettingsScreen, { tab: tab });
}
