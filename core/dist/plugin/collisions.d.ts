/**
 * Blocks, at startup, a config where a plugin uses the same path or name as the core or another plugin. Ensures one side is never silently shadowed.
 * This module does not read the site config (the authoring API imports it).
 */
/** A single-segment path of the core admin UI (`/admin/<path>`). An empty string is the list view. Keep it identical to the admin UI's path picking. */
export declare const CORE_ADMIN_PAGES: readonly string[];
/**
 * Names the core uses in the admin meta API `features`, and the plugin storage it keeps for itself (`core-events`: the marks of `event.once`).
 * Cannot be used as plugin names.
 */
export declare const CORE_FEATURE_KEYS: readonly string[];
/** Error if a plugin name collides with a core `features` name. */
export declare function assertPluginNamesFree(names: readonly string[]): void;
/**
 * Error if a plugin admin UI path (`path` in `nav`, or a key of an admin plugin's `pages`) equals a core page or another plugin's.
 * The same path within one plugin counts as one page.
 */
export declare function assertPluginPagesFree(pages: readonly {
    readonly plugin: string;
    readonly path: string;
}[]): void;
/**
 * Error if a plugin API route has the same shape as a core route (`corePatterns`), `auth/...`, or another plugin's route.
 * The core route matches first so the plugin route could never be used; this reports it.
 */
export declare function assertPluginRoutesFree(corePatterns: readonly string[], routes: readonly {
    readonly plugin: string;
    readonly pattern: string;
}[]): void;
