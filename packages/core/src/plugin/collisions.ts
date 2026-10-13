/**
 * Blocks, at startup, a config where a plugin uses the same path or name as the core or another plugin. Ensures one side is never silently shadowed.
 * This module does not read the site config (the authoring API imports it).
 */

/** Names the core uses in the admin meta API `features`. Cannot be used as plugin names. */
export const CORE_FEATURE_KEYS: readonly string[] = ["folders", "references", "search", "templates", "media"];

/** The storage and secrets scope of the login connection (`cms.secrets("auth")`, its plugin storage). */
export const AUTH_SCOPE = "auth";
/** The storage and secrets scope of the API key store. */
export const API_KEYS_SCOPE = "core-keys";
/** The plugin storage the core keeps the marks of `event.once` in. */
export const EVENTS_SCOPE = "core-events";

/**
 * Storage and secrets scopes the core keeps for itself. A plugin reads its own scope by its name, so a plugin named like one of these would read the core's
 * secrets and data. Cannot be used as plugin names; the core's own scopes are taken from here.
 */
export const RESERVED_SCOPES: readonly string[] = [AUTH_SCOPE, API_KEYS_SCOPE, EVENTS_SCOPE];

const trimSlashes = (path: string) => path.replace(/^\/+|\/+$/g, "");
const showPage = (path: string) => `/${path}`;

/** Error if a plugin name collides with a core `features` name or a core storage and secrets scope. */
export function assertPluginNamesFree(names: readonly string[]): void {
	for (const name of names) {
		if (CORE_FEATURE_KEYS.includes(name)) {
			throw new Error(`cms plugin: plugin name "${name}" collides with the core feature "${name}"`);
		}
		if (RESERVED_SCOPES.includes(name)) {
			throw new Error(`cms plugin: plugin name "${name}" collides with the core storage scope "${name}"`);
		}
	}
}

/**
 * Error if a plugin Tools page (`path` in `nav`, or a key of an admin plugin's `pages`) is empty or equals another plugin's.
 * Pages live under `<admin path>/tools/`, so they cannot collide with a core screen. The same path within one plugin counts as one page.
 */
export function assertPluginPagesFree(pages: readonly { readonly plugin: string; readonly path: string }[]): void {
	const owners = new Map<string, string>();
	for (const { plugin, path } of pages) {
		const key = trimSlashes(path);
		if (key === "") {
			throw new Error(`cms plugin: tools page "${showPage(key)}" of plugin "${plugin}" has no path`);
		}
		const owner = owners.get(key);
		if (owner !== undefined && owner !== plugin) {
			throw new Error(
				`cms plugin: tools page "${showPage(key)}" of plugin "${plugin}" collides with plugin "${owner}" (same tools page)`,
			);
		}
		owners.set(key, plugin);
	}
}

/** `[name]` segments with different names but the same shape count as the same route. */
const shape = (pattern: string) =>
	pattern
		.split("/")
		.map((segment) => (segment.startsWith("[") && segment.endsWith("]") ? "[]" : segment))
		.join("/");

/**
 * Error if a plugin API route has the same shape as a core route (`corePatterns`), `auth/...`, or another plugin's route.
 * The core route matches first so the plugin route could never be used; this reports it.
 */
export function assertPluginRoutesFree(
	corePatterns: readonly string[],
	routes: readonly { readonly plugin: string; readonly pattern: string }[],
): void {
	const core = new Map(corePatterns.map((pattern) => [shape(pattern), pattern]));
	const owners = new Map<string, { plugin: string; pattern: string }>();
	for (const { plugin, pattern } of routes) {
		const key = shape(pattern);
		const coreRoute = core.get(key);
		if (coreRoute !== undefined) {
			throw new Error(
				`cms plugin: API route "${pattern}" of plugin "${plugin}" collides with the core route "${coreRoute}"`,
			);
		}
		if (key.split("/")[0] === "auth") {
			throw new Error(
				`cms plugin: API route "${pattern}" of plugin "${plugin}" collides with the core "auth/*" routes`,
			);
		}
		const owner = owners.get(key);
		if (owner) {
			throw new Error(
				`cms plugin: API route "${pattern}" of plugin "${plugin}" collides with the route "${owner.pattern}" of plugin "${owner.plugin}"`,
			);
		}
		owners.set(key, { plugin, pattern });
	}
}
