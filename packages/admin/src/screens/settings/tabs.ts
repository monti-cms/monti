import type { Site } from "@monti-cms/core/client";

/**
 * The tabs of the Settings page, in display order. The schema tabs all edit the one schema file (`monti.schema.ts`) and share one draft, so the screen keeps it while you move between them.
 * Body templates, the event log and the plugin pages are not Settings tabs: they have their own sidebar items and addresses.
 */
export const SCHEMA_TABS = ["collections", "locales", "site", "admin", "file"] as const;
export type SchemaTab = (typeof SCHEMA_TABS)[number];

export const isSchemaTab = (tab: string): tab is SchemaTab => (SCHEMA_TABS as readonly string[]).includes(tab);

/** The API keys tab is not part of the schema file: the keys live in the database, so it has no draft to keep. */
export const API_KEYS_TAB = "api-keys";

/** Every tab of the Settings page, in display order: the schema file's, with the API keys between Admin and File. */
export const SETTINGS_TABS = ["collections", "locales", "site", "admin", API_KEYS_TAB, "file"] as const;
export type SettingsTabId = (typeof SETTINGS_TABS)[number];

export const isSettingsTab = (tab: string): tab is SettingsTabId => (SETTINGS_TABS as readonly string[]).includes(tab);

/** One tab of the Settings page. */
export interface SettingsTab {
	readonly id: SettingsTabId;
	readonly href: string;
}

/** The tabs of a site's Settings page, in order. */
export function settingsTabs(site: Pick<Site, "adminHref">): readonly SettingsTab[] {
	return SETTINGS_TABS.map((id) => ({ id, href: site.adminHref(`/settings/${id}`) }));
}

/** A plugin's page in the Tools group of the sidebar (`nav` item of the plugin definition). */
export interface ToolsPage {
	/** Single-segment address: `<admin path>/tools/<path>`. */
	readonly path: string;
	readonly href: string;
	readonly label: string;
	/** Icon name (lucide). */
	readonly icon?: string;
}

/** The Tools pages of a site's plugins, in plugin order. */
export function toolsPages(site: Pick<Site, "adminHref" | "plugins">): readonly ToolsPage[] {
	return site.plugins.flatMap((entry) =>
		(entry.nav ?? []).map(
			(item): ToolsPage => ({
				path: item.path.replace(/^\/+|\/+$/g, ""),
				href: site.adminHref(`/tools/${item.path.replace(/^\/+|\/+$/g, "")}`),
				label: item.label,
				icon: item.icon,
			}),
		),
	);
}
