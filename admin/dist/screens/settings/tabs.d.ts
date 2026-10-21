import type { Site } from "@monti-cms/core/site";
/**
 * The tabs of the Settings page, in display order. They all edit the one schema file (`monti.schema.ts`) and share one draft, so the screen keeps it while you move between them.
 * Anything that is not the schema file is not a Settings tab: Data, body templates, the API keys, the event log and the plugin pages have their own sidebar items and addresses.
 */
export declare const SCHEMA_TABS: readonly ["site", "locales", "collections", "admin"];
export type SchemaTab = (typeof SCHEMA_TABS)[number];
export declare const isSchemaTab: (tab: string) => tab is SchemaTab;
/** One tab of the Settings page. */
export interface SettingsTab {
    readonly id: SchemaTab;
    readonly href: string;
}
/** The tabs of a site's Settings page, in order. */
export declare function settingsTabs(site: Pick<Site, "adminHref">): readonly SettingsTab[];
