import type { Site } from "@monti-cms/core/client";
/**
 * The tabs of the Settings page, in display order. They all edit the one schema file (`monti.schema.ts`) and share one draft, so the screen keeps it while you move between them.
 * Body templates, the API keys, the event log and the plugin pages are not Settings tabs: they have their own sidebar items and addresses.
 */
export declare const SCHEMA_TABS: readonly ["site", "locales", "collections", "file", "admin"];
export type SchemaTab = (typeof SCHEMA_TABS)[number];
export declare const isSchemaTab: (tab: string) => tab is SchemaTab;
/** Every tab of the Settings page, in display order. The API keys are not here: they are kept encrypted in the database and saved at once, so they have their own page in Tools. */
export declare const SETTINGS_TABS: readonly ["site", "locales", "collections", "file", "admin"];
export type SettingsTabId = SchemaTab;
export declare const isSettingsTab: typeof isSchemaTab;
/** One tab of the Settings page. */
export interface SettingsTab {
    readonly id: SettingsTabId;
    readonly href: string;
}
/** The tabs of a site's Settings page, in order. */
export declare function settingsTabs(site: Pick<Site, "adminHref">): readonly SettingsTab[];
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
export declare function toolsPages(site: Pick<Site, "adminHref" | "plugins">): readonly ToolsPage[];
