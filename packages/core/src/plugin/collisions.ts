import { CONFIG_SOURCE, type Issue, IssueList, pathOf, throwIssues } from "../config/check/issue";

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

/**
 * Storage and secrets scopes the core keeps for itself. A plugin reads its own scope by its name, so a plugin named like one of these would read the core's
 * secrets and data. Cannot be used as plugin names; the core's own scopes are taken from here.
 */
export const RESERVED_SCOPES: readonly string[] = [AUTH_SCOPE, API_KEYS_SCOPE];

const trimSlashes = (path: string) => path.replace(/^\/+|\/+$/g, "");
const showPage = (path: string) => `/${path}`;

/** The plugin names that collide with a core `features` name or a core storage and secrets scope, or with each other. */
export function checkPluginNames(names: readonly string[]): Issue[] {
	const list = new IssueList();
	for (const [index, name] of names.entries()) {
		const at = pathOf("plugins", index, "name");
		if (CORE_FEATURE_KEYS.includes(name))
			list.add(at, "collision", `"${name}" collides with the core feature "${name}"`);
		else if (RESERVED_SCOPES.includes(name))
			list.add(at, "collision", `"${name}" collides with the core storage scope "${name}"`);
		else if (names.indexOf(name) !== index) list.add(at, "duplicate", `"${name}" is listed twice`);
	}
	return list.issues;
}

/** Throws a {@link ConfigError} if a plugin name collides. */
export const assertPluginNamesFree = (names: readonly string[]): void =>
	throwIssues(CONFIG_SOURCE, checkPluginNames(names));

/**
 * The plugin Tools pages (`path` in `nav`, or a key of an admin plugin's `pages`) that are empty or equal another plugin's.
 * Pages live under `<admin path>/tools/`, so they cannot collide with a core screen. The same path within one plugin counts as one page.
 */
export function checkPluginPages(pages: readonly { readonly plugin: string; readonly path: string }[]): Issue[] {
	const list = new IssueList();
	const owners = new Map<string, string>();
	for (const { plugin, path } of pages) {
		const key = trimSlashes(path);
		const at = pathOf("plugins", plugin, "nav", showPage(key));
		if (key === "") {
			list.add(at, "empty", `tools page "${showPage(key)}" of plugin "${plugin}" has no path`);
			continue;
		}
		const owner = owners.get(key);
		if (owner !== undefined && owner !== plugin) {
			list.add(
				at,
				"collision",
				`tools page "${showPage(key)}" of plugin "${plugin}" collides with plugin "${owner}" (same tools page)`,
			);
		}
		owners.set(key, plugin);
	}
	return list.issues;
}

/** Throws a {@link ConfigError} if a plugin Tools page is empty or collides. */
export const assertPluginPagesFree = (pages: readonly { readonly plugin: string; readonly path: string }[]): void =>
	throwIssues(CONFIG_SOURCE, checkPluginPages(pages));

/** `[name]` segments with different names but the same shape count as the same route. */
const shape = (pattern: string) =>
	pattern
		.split("/")
		.map((segment) => (segment.startsWith("[") && segment.endsWith("]") ? "[]" : segment))
		.join("/");

/**
 * The plugin API routes that have the same shape as a core route (`corePatterns`), `auth/...`, or another plugin's route.
 * The core route matches first so the plugin route could never be used; this reports it.
 */
export function checkPluginRoutes(
	corePatterns: readonly string[],
	routes: readonly { readonly plugin: string; readonly pattern: string }[],
): Issue[] {
	const list = new IssueList();
	const core = new Map(corePatterns.map((pattern) => [shape(pattern), pattern]));
	const owners = new Map<string, { plugin: string; pattern: string }>();
	for (const { plugin, pattern } of routes) {
		const key = shape(pattern);
		const at = pathOf("plugins", plugin, "routes", pattern);
		const coreRoute = core.get(key);
		if (coreRoute !== undefined) {
			list.add(at, "collision", `collides with the core route "${coreRoute}"`);
			continue;
		}
		if (key.split("/")[0] === "auth") {
			list.add(at, "collision", `collides with the core "auth/*" routes`);
			continue;
		}
		const owner = owners.get(key);
		if (owner) list.add(at, "collision", `collides with the route "${owner.pattern}" of plugin "${owner.plugin}"`);
		else owners.set(key, { plugin, pattern });
	}
	return list.issues;
}

/** Throws a {@link ConfigError} if a plugin API route collides. */
export const assertPluginRoutesFree = (
	corePatterns: readonly string[],
	routes: readonly { readonly plugin: string; readonly pattern: string }[],
): void => throwIssues(CONFIG_SOURCE, checkPluginRoutes(corePatterns, routes));
