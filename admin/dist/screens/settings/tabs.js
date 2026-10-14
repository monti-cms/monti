/**
 * The tabs of the Settings page, in display order. They all edit the one schema file (`monti.schema.ts`) and share one draft, so the screen keeps it while you move between them.
 * Body templates, the API keys, the event log and the plugin pages are not Settings tabs: they have their own sidebar items and addresses.
 */
export const SCHEMA_TABS = ["site", "locales", "collections", "file", "admin"];
export const isSchemaTab = (tab) => SCHEMA_TABS.includes(tab);
/** The tabs of a site's Settings page, in order. */
export function settingsTabs(site) {
    return SCHEMA_TABS.map((id) => ({ id, href: site.adminHref(`/settings/${id}`) }));
}
