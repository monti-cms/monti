import type { Site } from "@monti-cms/core/site";
/** A plugin's page in the Tools group of the sidebar (`nav` item of the plugin definition). */
export interface ToolsPage {
    /** The plugin whose `nav` item this is, and whose admin side draws the page (`pages[path]`). */
    readonly plugin: string;
    /** Single-segment address: `<admin path>/tools/<path>`. */
    readonly path: string;
    readonly href: string;
    readonly label: string;
    /** Icon name (lucide). */
    readonly icon?: string;
}
/** The Tools pages of a site's plugins, in plugin order. */
export declare function toolsPages(site: Pick<Site, "adminHref" | "plugins" | "createTranslator">): readonly ToolsPage[];
