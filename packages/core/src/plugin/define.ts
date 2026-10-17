import type { AiContribution } from "../ai-contract";
import type { BlockDefinition } from "../blocks/define";
import type { ConfigIssue } from "../config/check/issue";
import type { CollectionsConfig } from "../config/define";
import type { CmsFormat } from "../format/types";
import type { RouteAccess } from "../http/v1/handler";
import type { RenderPlugin } from "../render/plugin-render";
import type { PluginFieldSet } from "../schema/field-sets";
import type { PluginPlacement } from "../schema/layout";
import type { PluginScope, WriteHooks } from "../services/hooks";
import type { Site } from "../site";

/** A label shown in the admin: plain text, or a function of the site that follows the admin language (`(site) => site.createTranslator(messages)("label")`). */
export type PluginLabel = string | ((site: Pick<Site, "createTranslator">) => string);

/**
 * Plugin. Listed once in `plugins` of the site config (`cms.config.ts`). Its parts are grouped by who reads them:
 *
 * - **Both sides** read `options`, `blocks`, `nav`, `keySlots`, `checkConfig` and `contributes`. Apart from functions, only JSON values go here.
 * - **The server** reads `server`: routes, hooks, formats, commands, migrations, feature flags and the labels of key uses, always as a loader of a module of their own
 *   (`server: () => import("./server")`). The factory module can reach the browser bundle, so server code never sits in it: only the module behind the loader holds it,
 *   and a plugin package gives that module an empty browser entry point (the `browser` condition of `exports`).
 * - **The admin UI** reads `admin` (a loader), and **the public page** reads `render` (a loader).
 *
 * Every concept has one place: hooks only in `server`, API key slots only in `keySlots`.
 */
export interface Plugin<
	Name extends string = string,
	Options = unknown,
	Blocks extends readonly BlockDefinition[] = readonly BlockDefinition[],
> {
	readonly name: Name;
	readonly options: Options;
	/** Body blocks (block extension). Added by the same rules as `blocks` in the site config. */
	readonly blocks?: Blocks;
	/** Pages to add to the Tools group of the admin sidebar. `path` is a single-segment address (`<admin path>/tools/<path>`, default `/admin/tools/<path>`), rendered by the admin plugin's `pages`. */
	readonly nav?: readonly PluginNavItem[];
	/**
	 * The API keys this plugin needs, one slot each. Tools > API keys lists every slot of the installed plugins: assigned (the key's "in use" line names it) or empty
	 * (a row to pick a saved key or enter a new one, and to clear it again). The plugin reads its key with `plugin.key(<slot id>).read()`.
	 * Uses of a key that are not slots (an item of the plugin that has its own key, like an AI connection) are reported with `cms.apiKeys.setUses` and labelled by `server.keyUses`.
	 */
	readonly keySlots?: readonly PluginKeySlot[];
	/** Validation called when the site config is created. Returns the issues it finds (a path into the config and a message each); `defineSite` reports them with every other problem. */
	// biome-ignore lint/suspicious/noConfusingVoidType: a plugin with nothing to report returns nothing
	readonly checkConfig?: (config: PluginConfigView) => readonly ConfigIssue[] | void;
	/**
	 * Server side: a loader of a module whose default export is `defineServerPlugin({ routes, hooks, formats, ... })` (`@monti-cms/core/server`), written
	 * `server: () => import("./server")`. Read on the server only, when first needed. There is no inline form: whatever the factory module holds can end up in the browser.
	 */
	readonly server?: () => Promise<{ readonly default: ServerPlugin }>;
	/** Admin UI side (pages, block views, slots, providers): a loader of a module whose default export is `defineAdminPlugin({ ... })` (`@monti-cms/admin`). */
	readonly admin?: () => Promise<{ readonly default: AdminPluginShape }>;
	/**
	 * Public UI side (the components of its body blocks): a loader of a module whose default export is `defineRender({ blocks, marks, codeTags })`
	 * (`@monti-cms/core/render`). It is read on the server, by the document renderer; the module marks client components with `"use client"`.
	 */
	readonly render?: () => Promise<{ readonly default: RenderPlugin }>;
	/**
	 * What this plugin adds to other plugins, by the key the receiving side reads (see {@link PluginContributions}): `ai` (actions of the AI plugin), `layout` (the
	 * tabs of the edit screen's properties panel this plugin places its fields in) and `fieldSets` (field sets the schema screen offers). Unused if no plugin receives it.
	 */
	readonly contributes?: PluginContributions;
}

/**
 * What a plugin can add to other plugins (`contributes`), by key. The core reads `layout` and `fieldSets`, and the AI plugin reads `ai`. A plugin that receives
 * something of its own adds its key to this interface, so the plugins that give it are checked:
 *
 * ```ts
 * declare module "@monti-cms/core" {
 *   interface PluginContributions {
 *     readonly search?: { readonly fields: readonly string[] };
 *   }
 * }
 * ```
 *
 * Values that are data reach the browser's snapshot; functions stay on the server.
 */
export interface PluginContributions {
	/** AI actions this plugin adds (read by `@monti-cms/ai`). */
	readonly ai?: AiContribution;
	/** Where this plugin places its fields in the properties panel. */
	readonly layout?: readonly PluginPlacement[];
	/** Field sets the schema screen offers to add to a collection. */
	readonly fieldSets?: readonly PluginFieldSet[];
}

/**
 * What the core knows of a plugin's admin side: the parts `defineAdminPlugin` (`@monti-cms/admin`) declares, with the values the admin reads left open. It
 * keeps a module of another kind (a render module, a server module) out of `admin`.
 */
export interface AdminPluginShape {
	readonly pages?: Readonly<Record<string, unknown>>;
	readonly components?: unknown;
	readonly slots?: readonly unknown[];
	readonly Provider?: unknown;
}

/** One API key a plugin needs. */
export interface PluginKeySlot {
	/** Lowercase letters, digits and `-`. Unique within the plugin. */
	readonly id: string;
	/**
	 * The name of the service the key is for, the same in every language ("Bareun", "GitHub"). A key entered for this slot is saved under it (`Bareun`, then
	 * `Bareun 2` when taken), so the stored name never depends on the admin language.
	 */
	readonly service: string;
	/**
	 * What the admin calls this key ("Spell check"), for display only. Give a function of the site to follow the admin language (`(site) => site.createTranslator(messages)("keyLabel")`):
	 * the core calls it with the site of the instance each time the slots are listed. A plain string is shown as it is.
	 */
	readonly label: PluginLabel;
	/**
	 * Called after a key was assigned to the slot or the slot was cleared (in the admin, or by `plugin.key(id).set/assign`), once the change is saved, with the
	 * plugin's scope. Use it for work that waits for the key (a sync that was held back for lack of a token). Not called for changes made inside `cms.transaction`.
	 */
	readonly onChange?: (scope: PluginScope) => Promise<void> | void;
}

export interface PluginNavItem {
	readonly path: string;
	/** The page name in the sidebar. A function of the site follows the admin language. */
	readonly label: PluginLabel;
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
	readonly plugins: readonly Plugin[];
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/**
 * One plugin API route. `pattern` is the path after `/api/monti/` (e.g. `v1/ai/run`) and `[name]` is a single segment.
 * The router guards it by its `access` kind, `admin` when left out (a same-origin check, then the admin login). A route that must be reachable without login names the kind
 * that says why: `public-read` (GET only), `same-origin-form` (a browser form post), `signed` (a webhook: the handler verifies the signature) or `admin-or-bearer`
 * (a session, or a bearer token the handler verifies).
 */
export interface PluginRoute {
	readonly pattern: string;
	readonly module: Partial<Record<Method, unknown>>;
	readonly access?: RouteAccess;
}

/** A `PluginRoute` tagged with its plugin (the name is used in the error when paths collide). */
export interface OwnedPluginRoute extends PluginRoute {
	readonly plugin: string;
}

/**
 * The server side of a plugin, empty. A plugin package's `server.browser.ts` (the `browser` condition of its `exports`) re-exports this as the default, so the
 * browser bundle that reads the site config gets no server code: `export { emptyServerPlugin as default } from "@monti-cms/core";`.
 */
export const emptyServerPlugin: ServerPlugin = {};

/**
 * Types the server side of a plugin: `export default defineServerPlugin({ routes, hooks, ... })` in the module that the plugin's `server` loads
 * (`@monti-cms/core/server`). It returns what it is given.
 */
export const defineServerPlugin = (plugin: ServerPlugin): ServerPlugin => plugin;

export interface ServerPlugin {
	/**
	 * Looks up paths missing from the core routes in this route table. A route handler gets the instance it is served by and the plugin's own context
	 * (`adminRoute(async ({ cms, plugin }) => ...)`), so a plugin reads the stores from `cms`, its storage, secrets and key slots from `plugin`, and keeps no global state for them.
	 */
	readonly routes?: readonly PluginRoute[];
	/**
	 * Called by `monti db:migrate` after the core tables, with the plugin's scope: `plugin.storage.once(name, step)` runs one-time work (e.g. moving data from an
	 * earlier layout). Must give the same result when called repeatedly. `cms` is the instance being migrated.
	 */
	readonly migrate?: (scope: PluginScope) => Promise<void>;
	/**
	 * What the admin shows for each item of this plugin that uses an API key (`cms.apiKeys.setUses(plugin, [{ ref, keyId }])`): the text for each `ref`, in the admin language
	 * (`cms.site.createTranslator`) and with the item's name as it is now, or `null` when the item does not exist any more (its use is dropped). Called whenever the keys are listed.
	 */
	readonly keyUses?: (refs: readonly string[], scope: PluginScope) => Promise<Readonly<Record<string, string | null>>>;
	/** Value to put in `features.<plugin name>` of the admin meta API (`/v1/meta`). Does not mix with other plugins or core names. `cms` is the instance serving the request. */
	readonly features?: (scope: PluginScope) => Promise<Readonly<Record<string, boolean>>>;
	/**
	 * Hooks on every content write (same shape as the server config `hooks`): `transform`, `validate`, `validatePublish` and `afterCommit`. Each gets its own
	 * argument and then the plugin's scope `{ cms, plugin }`. They run after the server config's hooks, in the order of the plugins in the site config.
	 */
	readonly hooks?: WriteHooks<PluginScope>;
	/**
	 * Formats this plugin adds (`@monti-cms/core/format`): notations the stored document can be written as and read from, picked with the `format` option of
	 * the read and write APIs. Called with the plugin's scope when the instance first needs its formats (a format that depends on the plugin's options reads them with
	 * `cms.site.pluginOptions(...)`); two formats with one name (a plugin's and a built-in one included) fail there.
	 */
	readonly formats?: (
		scope: PluginScope,
	) => Promise<CmsFormat | readonly CmsFormat[]> | CmsFormat | readonly CmsFormat[];
	/**
	 * Command line commands of this plugin: `monti <plugin name>:<command>` loads the app (like `monti db:migrate`), runs the command with the instance and
	 * exits with the code it returns (0 when it returns nothing). The key is the command name after the colon (lowercase letters, digits and `-`).
	 */
	readonly commands?: Readonly<Record<string, PluginCommand>>;
}

/** One command line option of a plugin command. */
export interface PluginCommandOption {
	readonly type: "string" | "boolean";
	/** One line for `monti <plugin>:<command> --help`. */
	readonly description?: string;
}

/** What a plugin command receives: the plugin's scope (`cms`, `plugin`) and the command line. */
export interface PluginCommandContext extends PluginScope {
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
 * Creates a plugin. A plugin package exports a function (e.g. `ai()`) that returns this value. The type of what it adds (`contributes`)
 * is preserved so the receiving plugin can read it (e.g. AI feature names).
 */
export function definePlugin<
	const Name extends string,
	Options = Record<string, never>,
	const Blocks extends readonly BlockDefinition[] = readonly BlockDefinition[],
	const Contributes extends PluginContributions = PluginContributions,
>(
	plugin: Omit<Plugin<Name, Options, Blocks>, "options"> & {
		/** Config values both sides read. Optional: a plugin without any (a hook-only plugin) has `{}`. */
		readonly options?: Options;
		readonly contributes?: Contributes;
	},
): Plugin<Name, Options, Blocks> & { readonly contributes?: Contributes } {
	if (!/^[a-z][a-z0-9-]*$/.test(plugin.name)) throw new Error(`cms plugin: invalid name "${plugin.name}"`);
	return { ...plugin, options: plugin.options ?? ({} as Options) };
}

declare const pluginOptionsType: unique symbol;

/**
 * A plugin's name with the type of its options, for reading them from a site: `site.pluginOptions(GIT_SYNC_PLUGIN)` is `GitSyncOptions | undefined`. A plugin
 * package declares it once, next to its options type: `export const GIT_SYNC_PLUGIN: PluginId<"git-sync", GitSyncOptions> = { name: "git-sync" };`.
 */
export interface PluginId<Name extends string = string, Options = unknown> {
	readonly name: Name;
	/** Type only: carries the options' type, and is never set. */
	readonly [pluginOptionsType]?: Options;
}

/** The type of a plugin picked by name from the site config's plugin list. */
export type PluginNamed<Plugins, Name extends string> = Plugins extends readonly (infer P)[]
	? Extract<P, Plugin<Name, unknown>>
	: never;
