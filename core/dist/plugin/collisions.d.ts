import { type ConfigIssue } from "../config/check/issue.js";
/**
 * Blocks, at startup, a config where a plugin uses the same path or name as the core or another plugin. Ensures one side is never silently shadowed.
 * This module does not read the site config (the authoring API imports it).
 */
/** Names the core uses in the admin meta API `features`. Cannot be used as plugin names. */
export declare const CORE_FEATURE_KEYS: readonly string[];
/** The storage and secrets scope of the login connection (`AuthCreateContext.secrets`, its plugin storage). */
export declare const AUTH_SCOPE = "auth";
/** The storage and secrets scope of the API key store. */
export declare const API_KEYS_SCOPE = "core-keys";
/**
 * Storage and secrets scopes the core keeps for itself. A plugin reads its own scope by its name, so a plugin named like one of these would read the core's
 * secrets and data. Cannot be used as plugin names; the core's own scopes are taken from here.
 */
export declare const RESERVED_SCOPES: readonly string[];
/** The plugin names that collide with a core `features` name or a core storage and secrets scope, or with each other. */
export declare function checkPluginNames(names: readonly string[]): ConfigIssue[];
/**
 * The plugin Tools pages (`path` in `nav`, or a key of an admin plugin's `pages`) that are empty or equal another plugin's.
 * Pages live under `<admin path>/tools/`, so they cannot collide with a core screen. The same path within one plugin counts as one page.
 */
export declare function checkPluginPages(pages: readonly {
    readonly plugin: string;
    readonly path: string;
}[]): ConfigIssue[];
/**
 * The plugin API routes that have the same shape as a core route (`corePatterns`), `auth/...`, or another plugin's route.
 * The core route matches first so the plugin route could never be used; this reports it.
 */
export declare function checkPluginRoutes(corePatterns: readonly string[], routes: readonly {
    readonly plugin: string;
    readonly pattern: string;
}[]): ConfigIssue[];
/** Throws a {@link ConfigError} if a plugin API route collides. */
export declare const assertPluginRoutesFree: (corePatterns: readonly string[], routes: readonly {
    readonly plugin: string;
    readonly pattern: string;
}[]) => void;
