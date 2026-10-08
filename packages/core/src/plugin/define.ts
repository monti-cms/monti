import type { BlockDefinition } from "../blocks/define";
import type { Cms } from "../cms";
import type { CollectionsConfig } from "../config/define";
import type { CmsFormat } from "../format/types";
import type { WriteHooks } from "../services/hooks";
import type { DoctorCheck } from "./doctor";
import type { PluginStorage } from "./storage";

/**
 * Plugin. Listed once in `plugins` of the site config (`cms.config.ts`).
 *
 * - Config values (`options`), sidebar items (`nav`) and config validation (`validate`) are read by both server and browser. Apart from functions, only JSON values go here.
 * - Server code (`server`) and admin UI code (`admin`) are loader functions. They are read only when used, and the plugin package provides an empty browser entry point (the `browser` condition of `exports`)
 *   so server code stays out of the browser bundle.
 */
export interface CmsPlugin<
	Name extends string = string,
	Options = unknown,
	Blocks extends readonly BlockDefinition[] = readonly BlockDefinition[],
> {
	readonly name: Name;
	readonly options: Options;
	/** Items to add to the "Manage" group of the admin sidebar. `path` is a single-segment path after the admin path (`admin.path`, default `/admin`), rendered by the admin plugin's `pages`. */
	readonly nav?: readonly PluginNavItem[];
	/** Body blocks (block extension). Added by the same rules as `blocks` in the site config. */
	readonly blocks?: Blocks;
	/**
	 * npm packages this plugin needs in the app that it does not install itself (optional peers of its package, e.g. `recharts` for the chart block).
	 * `monti doctor` checks that each one is installed and says which command installs it.
	 */
	readonly requires?: readonly string[];
	/** Validation called when the site config is created. Throws if the config is invalid. */
	readonly validate?: (config: PluginConfigView) => void;
	/**
	 * Write hooks written inline, for a plugin that only needs hooks: `definePlugin({ name, hooks })` needs no `server` module. Inline code loads with
	 * every server start (the CLI, edge and cold starts included), so keep it light; it may use secrets through `cms.secrets` or the environment. A plugin
	 * with heavy hooks, or with routes, migrations, commands or checks, puts its hooks in `server` (a lazy module). Not both: a plugin with `hooks` here and in `server` fails when it loads.
	 */
	readonly hooks?: WriteHooks;
	/** Server side (API routes, migrations, hooks, commands, checks). The default export is a `CmsServerPlugin`. Read only on the server. */
	readonly server?: () => Promise<{ readonly default: CmsServerPlugin }>;
	/** Admin UI side (pages, providers). The default export is the admin package's `CmsAdminPlugin`. */
	readonly admin?: () => Promise<{ readonly default: unknown }>;
	/**
	 * Public UI side (public components for body blocks). The module's named export `documentComponents` is `(context) => component table` of the document renderer
	 * (`renderDocument`: `blocks` and `marks` by block name, `codeTags`). `@monti-cms/core/render` calls it (`context`: site locale, image resolver). It is read on
	 * the server; the module marks client components with `"use client"`.
	 */
	readonly render?: () => Promise<{ readonly documentComponents?: unknown }>;
	/**
	 * Formats this plugin adds (`@monti-cms/core/format`): notations the stored document can be written as and read from, picked with the `format` option of
	 * the read and write APIs. The default export is a `CmsFormat` or a list of them. It is read on the server when the instance first needs its formats;
	 * two formats with one name (a plugin's and a built-in one included) fail there.
	 */
	readonly formats?: () => Promise<{ readonly default: CmsFormat | readonly CmsFormat[] }>;
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

export interface CmsServerPlugin {
	/**
	 * Looks up paths missing from the core routes in this route table. A route handler gets the instance it is served by in its context
	 * (`adminRoute(async ({ cms }) => ...)`), so a plugin reads the stores, its storage (`cms.storage(name)`) and its secrets (`cms.secrets(name)`) from `cms` and keeps no global state for them.
	 */
	readonly routes?: readonly PluginRoute[];
	/**
	 * Called by `monti migrate` after the core tables, with the plugin's own storage (`storage.once(name, step)` runs one-time work, e.g. moving data from an earlier layout).
	 * Must give the same result when called repeatedly. `cms` is the instance being migrated.
	 */
	readonly migrate?: (storage: PluginStorage, cms: Cms) => Promise<void>;
	/** Value to put in `features.<plugin name>` of the admin meta API (`/v1/meta`). Does not mix with other plugins or core names. `cms` is the instance serving the request. */
	readonly features?: (cms: Cms) => Promise<Readonly<Record<string, boolean>>>;
	/**
	 * Hooks on every content write (same as the server config `hooks`): `transform`, `validate`, `validatePublish` and `afterCommit` (which gets the
	 * instance as its second argument, like the config's). They run after the server config's hooks, in the order of the plugins in the site config.
	 * A plugin may set them inline (`CmsPlugin.hooks`) or here, not in both.
	 */
	readonly hooks?: WriteHooks;
	/**
	 * Command line commands of this plugin: `monti <plugin name>:<command>` loads the app (like `monti migrate`), runs the command with the instance and
	 * exits with the code it returns (0 when it returns nothing). The key is the command name after the colon (lowercase letters, digits and `-`).
	 */
	readonly commands?: Readonly<Record<string, PluginCommand>>;
	/**
	 * Checks `monti doctor` runs for this plugin, listed under its name (`git-sync/token`): is its token saved, are its settings present, does it reach its service.
	 * A check says what it found, where, and how to fix it ({@link DoctorCheck}); one that calls out over the network sets `online: true` and runs only with
	 * `monti doctor --online`. The checks get the app's instance, so they read the plugin's storage and secrets like a route does.
	 */
	readonly checks?: readonly DoctorCheck[];
}

/** One command line option of a plugin command. */
export interface PluginCommandOption {
	readonly type: "string" | "boolean";
	/** One line for `monti <plugin>:<command> --help`. */
	readonly description?: string;
}

/** What a plugin command receives. */
export interface PluginCommandContext {
	readonly cms: Cms;
	/** The values of the options the command declared (`undefined` when not given). */
	readonly args: Readonly<Record<string, string | boolean | undefined>>;
	readonly log: (message: string) => void;
	readonly error: (message: string) => void;
}

/** A command a plugin adds to the `monti` command line. */
export interface PluginCommand {
	/** One line shown in `monti help` and `monti <plugin>:<command> --help`. */
	readonly description: string;
	/** The options it accepts, besides the ones every app command takes (`--env-file`, `--no-env-file`, `--server`). */
	readonly options?: Readonly<Record<string, PluginCommandOption>>;
	/** Runs the command. Returns the exit code (0 or nothing: success). Throwing prints the message and exits with 1. */
	// biome-ignore lint/suspicious/noConfusingVoidType: an async function that returns nothing is `Promise<void>`, and a command may be written that way
	readonly run: (context: PluginCommandContext) => Promise<number | void>;
}

/**
 * Creates a plugin. A plugin package exports a function (e.g. `aiPlugin()`) that returns this value. The type of what it adds (`contributes`)
 * is preserved so the receiving plugin can read it (e.g. AI feature names).
 */
export function definePlugin<
	const Name extends string,
	Options = Record<string, never>,
	const Blocks extends readonly BlockDefinition[] = readonly BlockDefinition[],
	const Contributes extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
>(
	plugin: Omit<CmsPlugin<Name, Options, Blocks>, "options"> & {
		/** Config values both sides read. Optional: a plugin without any (a hook-only plugin) has `{}`. */
		readonly options?: Options;
		readonly contributes?: Contributes;
	},
): CmsPlugin<Name, Options, Blocks> & { readonly contributes?: Contributes } {
	if (!/^[a-z][a-z0-9-]*$/.test(plugin.name)) throw new Error(`cms plugin: invalid name "${plugin.name}"`);
	return { ...plugin, options: plugin.options ?? ({} as Options) };
}

/** The type of a plugin picked by name from the site config's plugin list. */
export type PluginNamed<Plugins, Name extends string> = Plugins extends readonly (infer P)[]
	? Extract<P, CmsPlugin<Name, unknown>>
	: never;
