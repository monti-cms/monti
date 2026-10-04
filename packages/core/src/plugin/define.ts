import type { Pool, PoolClient } from "pg";
import type { AfterCommit } from "../adapters/postgres/store/after-commit";
import type { BlockDefinition } from "../blocks/define";
import type { CollectionsConfig } from "../config/define";

/**
 * Plugin. Listed once in `plugins` of the site config (`cms.config.ts`).
 *
 * - Config values (`options`), sidebar items (`nav`) and config validation (`validate`) are read by both server and browser. Apart from functions, only JSON values go here.
 * - Server code (`server`) and admin UI code (`admin`) are loader functions. They are read only when used, and the plugin package provides an empty browser entry point (the `browser` condition of `exports`)
 *   so server code stays out of the browser bundle.
 */
export interface CmsPlugin<Name extends string = string, Options = unknown> {
	readonly name: Name;
	readonly options: Options;
	/** Items to add to the "Manage" group of the admin sidebar. `path` is a single-segment path after the admin path (`admin.path`, default `/admin`), rendered by the admin plugin's `pages`. */
	readonly nav?: readonly PluginNavItem[];
	/** Body blocks (block extension). Added by the same rules as `blocks` in the site config. */
	readonly blocks?: readonly BlockDefinition[];
	/** Validation called when the site config is created. Throws if the config is invalid. */
	readonly validate?: (config: PluginConfigView) => void;
	/** Server side (API routes, migrations). The default export is a `CmsServerPlugin`. */
	readonly server?: () => Promise<{ readonly default: CmsServerPlugin }>;
	/** Admin UI side (pages, providers). The default export is the admin package's `CmsAdminPlugin`. */
	readonly admin?: () => Promise<{ readonly default: unknown }>;
	/**
	 * Public UI side (public components for body blocks). The default export is `(context) => component table` and `@monti-cms/core/render` calls it
	 * (`context`: site locale, image resolver). It is read on the server; the module marks client components with `"use client"`.
	 */
	readonly render?: () => Promise<{ readonly default: unknown }>;
	/**
	 * What this plugin adds to other plugins. The key is a name chosen by the receiving side (e.g. the AI plugin reads `ai: { actions }`), and the core does not read it.
	 * It is unused if no plugin receives it, so an extension can add features without knowing the receiving plugin.
	 */
	readonly contributes?: Readonly<Record<string, unknown>>;
}

export interface PluginNavItem {
	readonly path: string;
	readonly label: string;
	/** lucide icon name (e.g. `sparkles`). */
	readonly icon?: string;
}

/** Site config as seen by plugin validation. */
export interface PluginConfigView {
	readonly collections: CollectionsConfig;
	readonly locales: readonly { readonly code: string; readonly name?: string }[];
	readonly defaultLocale: string;
	/** Names of the body blocks the site uses (core blocks + blocks added by plugins and the site config). */
	readonly blocks: readonly string[];
	/** Definitions of those blocks (same order as `blocks`). */
	readonly blockDefinitions: readonly BlockDefinition[];
	/** All plugins in the site config (including itself). Used to read what other plugins add (`contributes`). */
	readonly plugins: readonly CmsPlugin[];
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/**
 * One plugin API route. `pattern` is the path after `/api/cms/` (e.g. `v1/ai/run`) and `[name]` is a single segment.
 * The core wraps it with the admin login check and a same-origin check. Only routes that must be reachable without login (external runners, webhooks, etc.) set `public: true`
 * to opt out, and then the route verifies the request itself.
 */
export interface PluginRoute {
	readonly pattern: string;
	readonly module: Partial<Record<Method, unknown>>;
	readonly public?: boolean;
}

/** A `PluginRoute` tagged with its plugin (the name is used in the error when paths collide). */
export interface OwnedPluginRoute extends PluginRoute {
	readonly plugin: string;
}

/** DB used by plugins (Postgres only for now). `schema` is a validated schema name, so it is safe to put into SQL as is. */
export interface PluginDatabase {
	readonly pool: Pool;
	readonly schema: string;
	/**
	 * One-time work (e.g. moving legacy data). The name is recorded in the core migration log so it does not run again, and it runs only once even if called concurrently.
	 * `run` uses the `client` it receives inside a transaction (on failure it rolls back and records nothing). Prefix the name with the plugin name.
	 * @returns whether it ran this time
	 */
	readonly once: (name: string, run: (client: PoolClient) => Promise<void>) => Promise<boolean>;
}

export interface CmsServerPlugin {
	/** Looks up paths missing from the core routes in this route table. */
	readonly routes?: readonly PluginRoute[];
	/** Called by `monti migrate` after the core tables. Must give the same result when called repeatedly. */
	readonly migrate?: (db: PluginDatabase) => Promise<void>;
	/** Value to put in `features.<plugin name>` of the admin meta API (`/v1/meta`). Does not mix with other plugins or core names. */
	readonly features?: () => Promise<Readonly<Record<string, boolean>>>;
	/** Notification after a save (same as the server config `afterCommit`). The save stands even if it fails. */
	readonly afterCommit?: AfterCommit;
}

/**
 * Creates a plugin. A plugin package exports a function (e.g. `aiPlugin()`) that returns this value. The type of what it adds (`contributes`)
 * is preserved so the receiving plugin can read it (e.g. AI feature names).
 */
export function definePlugin<
	const Name extends string,
	Options,
	const Contributes extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
>(
	plugin: CmsPlugin<Name, Options> & { readonly contributes?: Contributes },
): CmsPlugin<Name, Options> & { readonly contributes?: Contributes } {
	if (!/^[a-z][a-z0-9-]*$/.test(plugin.name)) throw new Error(`cms plugin: invalid name "${plugin.name}"`);
	return plugin;
}

/** The type of a plugin picked by name from the site config's plugin list. */
export type PluginNamed<Plugins, Name extends string> = Plugins extends readonly (infer P)[]
	? Extract<P, CmsPlugin<Name, unknown>>
	: never;
