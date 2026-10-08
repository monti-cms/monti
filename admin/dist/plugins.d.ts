import type { Site } from "@monti-cms/core/client";
import type { ComponentType, ReactNode } from "react";
/**
 * The admin UI side of a plugin. Loads the module that the plugin definition's (`definePlugin`) `admin` provides as its default export.
 * This module also ends up in the browser bundle, so do not put server-only code (DB, secrets) in it.
 */
export interface CmsAdminPlugin {
    /**
     * A `<path>` screen under the admin path (default `/admin/<path>`, a client component). The sidebar item is the plugin definition's `nav`.
     * The admin login check happens before the admin UI renders.
     */
    readonly pages?: Readonly<Record<string, ComponentType>>;
    /**
     * A provider that wraps the whole admin UI (client component). Inside it, use `CmsAdminComponentsProvider` to add field inputs and edit screen extensions,
     * or attach behavior to slots (`SlotRegistryProvider`).
     */
    readonly Provider?: ComponentType<{
        readonly children: ReactNode;
    }>;
}
/** Creates an admin plugin (only type-checks). */
export declare const defineAdminPlugin: (plugin: CmsAdminPlugin) => CmsAdminPlugin;
type LoadedAdminPlugins = Promise<readonly (CmsAdminPlugin & {
    readonly name: string;
})[]>;
/**
 * Loads the admin side of a site's plugins (`site.plugins`, the instance's real site, not the browser's snapshot: the loaders are server code). On success it is
 * read once per site and reused. If loading fails or a screen path collides with the core or another plugin, nothing is remembered so the next call retries,
 * and the error is thrown as is.
 */
export declare function loadAdminPlugins(site: Pick<Site, "plugins">): LoadedAdminPlugins;
export {};
