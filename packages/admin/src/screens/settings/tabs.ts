import type { Site } from "@monti-cms/core/client";

/**
 * The tabs of the Settings page, in display order. They all edit the one schema file (`monti.schema.ts`) and share one draft, so the screen keeps it while you move between them.
 * Body templates, the API keys, the event log and the plugin pages are not Settings tabs: they have their own sidebar items and addresses.
 */
export const SCHEMA_TABS = ["site", "locales", "collections", "file", "admin"] as const;
export type SchemaTab = (typeof SCHEMA_TABS)[number];

export const isSchemaTab = (tab: string): tab is SchemaTab => (SCHEMA_TABS as readonly string[]).includes(tab);

/** Every tab of the Settings page, in display order. The API keys are not here: they are kept encrypted in the database and saved at once, so they have their own page in Tools. */
export const SETTINGS_TABS = SCHEMA_TABS;
export type SettingsTabId = SchemaTab;

export const isSettingsTab = isSchemaTab;

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
export function toolsPages(site: Pick<Site, "adminHref" | "plugins" | "createTranslator">): readonly ToolsPage[] {
	return site.plugins.flatMap((entry) =>
		(entry.nav ?? []).map(
			(item): ToolsPage => ({
				path: item.path.replace(/^\/+|\/+$/g, ""),
				href: site.adminHref(`/tools/${item.path.replace(/^\/+|\/+$/g, "")}`),
				label: typeof item.label === "function" ? item.label(site) : item.label,
				icon: item.icon,
			}),
		),
	);
}
