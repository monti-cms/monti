/**
 * The tabs of the Settings page, in display order. They all edit the one schema file (`monti.schema.ts`) and share one draft, so the screen keeps it while you move between them.
 * Body templates, the API keys, the event log and the plugin pages are not Settings tabs: they have their own sidebar items and addresses.
 */
export const SCHEMA_TABS = ["site", "locales", "collections", "file", "admin"];
export const isSchemaTab = (tab) => SCHEMA_TABS.includes(tab);
/** Every tab of the Settings page, in display order. The API keys are not here: they are kept encrypted in the database and saved at once, so they have their own page in Tools. */
export const SETTINGS_TABS = SCHEMA_TABS;
export const isSettingsTab = isSchemaTab;
/** The tabs of a site's Settings page, in order. */
export function settingsTabs(site) {
    return SETTINGS_TABS.map((id) => ({ id, href: site.adminHref(`/settings/${id}`) }));
}
/** The Tools pages of a site's plugins, in plugin order. */
export function toolsPages(site) {
    return site.plugins.flatMap((entry) => (entry.nav ?? []).map((item) => ({
        path: item.path.replace(/^\/+|\/+$/g, ""),
        href: site.adminHref(`/tools/${item.path.replace(/^\/+|\/+$/g, "")}`),
        label: item.label,
        icon: item.icon,
    })));
}
