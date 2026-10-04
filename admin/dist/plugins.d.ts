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
/**
 * Loads the admin side of the site config's plugins. On success it is read once and reused.
 * If loading fails or a screen path collides with the core or another plugin, nothing is remembered so the next call retries, and the error is thrown as is.
 */
export declare function loadAdminPlugins(): Promise<readonly (CmsAdminPlugin & {
    readonly name: string;
})[]>;
