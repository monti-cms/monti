import type { Site } from "@monti-cms/core/client";

/** The tabs the schema file editor draws (they share one draft, so the screen keeps it while you move between them). */
export const SCHEMA_TABS = ["collections", "locales", "site", "admin", "file"] as const;
export type SchemaTab = (typeof SCHEMA_TABS)[number];

/** Core Settings tabs in display order. Keep the ids identical to `CORE_SETTINGS_TABS` of `@monti-cms/core` (a plugin tab cannot reuse one). */
export const CORE_TABS = [...SCHEMA_TABS, "templates", "events"] as const;
export type CoreTab = (typeof CORE_TABS)[number];

export const isSchemaTab = (tab: string): tab is SchemaTab => (SCHEMA_TABS as readonly string[]).includes(tab);

/** One tab of the Settings page. A plugin tab (`kind: "plugin"`) comes from the plugin definition's `nav`. */
export interface SettingsTab {
	readonly id: string;
	readonly kind: "core" | "plugin";
	readonly href: string;
	/** Icon name of a plugin tab (lucide). */
	readonly icon?: string;
	/** Label of a plugin tab. A core tab's label is looked up by `id`. */
	readonly label?: string;
}

/** Whether the site shows this tab: the Templates tab is off with `admin.templates: false`. */
export const coreTabEnabled = (site: Pick<Site, "ADMIN_TEMPLATES">, tab: CoreTab): boolean =>
	tab !== "templates" || site.ADMIN_TEMPLATES;

/** The tabs of a site's Settings page, in order: the core tabs, then one per plugin `nav` item. */
export function settingsTabs(site: Pick<Site, "ADMIN_TEMPLATES" | "adminHref" | "plugins">): readonly SettingsTab[] {
	const core = CORE_TABS.filter((tab) => coreTabEnabled(site, tab)).map(
		(id): SettingsTab => ({ id, kind: "core", href: site.adminHref(`/settings/${id}`) }),
	);
	const plugin = site.plugins.flatMap((entry) =>
		(entry.nav ?? []).map(
			(item): SettingsTab => ({
				id: item.path,
				kind: "plugin",
				href: site.adminHref(`/settings/${item.path}`),
				icon: item.icon,
				label: item.label,
			}),
		),
	);
	return [...core, ...plugin];
}
