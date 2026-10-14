import type { Site } from "@monti-cms/core/client";
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
export declare function toolsPages(site: Pick<Site, "adminHref" | "plugins" | "createTranslator">): readonly ToolsPage[];
