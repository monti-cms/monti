import type { Site } from "@monti-cms/core/site";

/**
 * The tabs of the Settings page, in display order. They all edit the one schema file (`monti.schema.ts`) and share one draft, so the screen keeps it while you move between them.
 * The Data tab ({@link DATA_TAB}) is not one of them. Body templates, the API keys, the event log and the plugin pages are not Settings tabs: they have their own sidebar items and addresses.
 */
export const SCHEMA_TABS = ["site", "locales", "collections", "admin"] as const;
export type SchemaTab = (typeof SCHEMA_TABS)[number];

export const isSchemaTab = (tab: string): tab is SchemaTab => (SCHEMA_TABS as readonly string[]).includes(tab);

/** The Data page: a tab beside the schema tabs, but a page of its own. It is not the schema file, so it has no draft and no save bar. */
export const DATA_TAB = "data";

/** One tab of the Settings page. */
export interface SettingsTab {
	readonly id: SchemaTab;
	readonly href: string;
}

/** The tabs of a site's Settings page, in order. */
export function settingsTabs(site: Pick<Site, "adminHref">): readonly SettingsTab[] {
	return SCHEMA_TABS.map((id) => ({ id, href: site.adminHref(`/settings/${id}`) }));
}
