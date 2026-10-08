/**
 * Blocks, at startup, a config where a plugin uses the same path or name as the core or another plugin. Ensures one side is never silently shadowed.
 * This module does not read the site config (the authoring API imports it).
 */
/** A single-segment path of the core admin UI (`/admin/<path>`). An empty string is the list view. Keep it identical to the admin UI's path picking. */
export const CORE_ADMIN_PAGES = ["", "entries", "login", "media", "templates", "trash"];
/**
 * Names the core uses in the admin meta API `features`, and the plugin storage it keeps for itself (`core-events`: the marks of `event.once`).
 * Cannot be used as plugin names.
 */
export const CORE_FEATURE_KEYS = [
    "folders",
    "references",
    "search",
    "templates",
    "media",
    "core-events",
];
const trimSlashes = (path) => path.replace(/^\/+|\/+$/g, "");
const showPage = (path) => `/${path}`;
/** Error if a plugin name collides with a core `features` name. */
export function assertPluginNamesFree(names) {
    for (const name of names) {
        if (CORE_FEATURE_KEYS.includes(name)) {
            throw new Error(`cms plugin: plugin name "${name}" collides with the core feature "${name}"`);
        }
    }
}
/**
 * Error if a plugin admin UI path (`path` in `nav`, or a key of an admin plugin's `pages`) equals a core page or another plugin's.
 * The same path within one plugin counts as one page.
 */
export function assertPluginPagesFree(pages) {
    const owners = new Map();
    for (const { plugin, path } of pages) {
        const key = trimSlashes(path);
        if (CORE_ADMIN_PAGES.includes(key)) {
            throw new Error(`cms plugin: admin page "${showPage(key)}" of plugin "${plugin}" collides with the core admin page "${showPage(key)}"`);
        }
        const owner = owners.get(key);
        if (owner !== undefined && owner !== plugin) {
            throw new Error(`cms plugin: admin page "${showPage(key)}" of plugin "${plugin}" collides with plugin "${owner}" (same admin page)`);
        }
        owners.set(key, plugin);
    }
}
/** `[name]` segments with different names but the same shape count as the same route. */
const shape = (pattern) => pattern
    .split("/")
    .map((segment) => (segment.startsWith("[") && segment.endsWith("]") ? "[]" : segment))
    .join("/");
/**
 * Error if a plugin API route has the same shape as a core route (`corePatterns`), `auth/...`, or another plugin's route.
 * The core route matches first so the plugin route could never be used; this reports it.
 */
export function assertPluginRoutesFree(corePatterns, routes) {
    const core = new Map(corePatterns.map((pattern) => [shape(pattern), pattern]));
    const owners = new Map();
    for (const { plugin, pattern } of routes) {
        const key = shape(pattern);
        const coreRoute = core.get(key);
        if (coreRoute !== undefined) {
            throw new Error(`cms plugin: API route "${pattern}" of plugin "${plugin}" collides with the core route "${coreRoute}"`);
        }
        if (key.split("/")[0] === "auth") {
            throw new Error(`cms plugin: API route "${pattern}" of plugin "${plugin}" collides with the core "auth/*" routes`);
        }
        const owner = owners.get(key);
        if (owner) {
            throw new Error(`cms plugin: API route "${pattern}" of plugin "${plugin}" collides with the route "${owner.pattern}" of plugin "${owner.plugin}"`);
        }
        owners.set(key, { plugin, pattern });
    }
}
