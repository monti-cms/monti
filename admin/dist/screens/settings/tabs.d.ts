import type { Site } from "@monti-cms/core/site";
/**
 * The tabs of the Settings page, in display order. They all edit the one schema file (`monti.schema.ts`) and share one draft, so the screen keeps it while you move between them.
 * The Data tab ({@link DATA_TAB}) is not one of them. Body templates, the API keys, the event log and the plugin pages are not Settings tabs: they have their own sidebar items and addresses.
 */
export declare const SCHEMA_TABS: readonly ["site", "locales", "collections", "admin"];
export type SchemaTab = (typeof SCHEMA_TABS)[number];
export declare const isSchemaTab: (tab: string) => tab is SchemaTab;
/** The Data page: a tab beside the schema tabs, but a page of its own. It is not the schema file, so it has no draft and no save bar. */
export declare const DATA_TAB = "data";
/** One tab of the Settings page. */
export interface SettingsTab {
    readonly id: SchemaTab;
    readonly href: string;
}
/** The tabs of a site's Settings page, in order. */
export declare function settingsTabs(site: Pick<Site, "adminHref">): readonly SettingsTab[];
