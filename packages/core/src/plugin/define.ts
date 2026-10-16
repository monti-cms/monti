import type { BlockDefinition } from "../blocks/define";
import type { Cms } from "../cms";
import type { Issue } from "../config/check/issue";
import type { CollectionsConfig } from "../config/define";
import type { CmsFormat } from "../format/types";
import type { RouteAccess } from "../http/v1/handler";
import type { WriteHooks } from "../services/hooks";
import type { Site } from "../site";
import type { PluginStorage } from "./storage";

/** A label shown in the admin: plain text, or a function of the site that follows the admin language (`(site) => site.createTranslator(messages)("label")`). */
export type PluginLabel = string | ((site: Pick<Site, "createTranslator">) => string);

/** The server side of a plugin: given inline, or as a loader of a module whose default export it is (read only when used). */
export type PluginServer = CmsServerPlugin | (() => Promise<{ readonly default: CmsServerPlugin }>);

/**
 * Plugin. Listed once in `plugins` of the site config (`cms.config.ts`). Its parts are grouped by who reads them:
 *
 * - **Both sides** read `options`, `blocks`, `nav`, `keySlots`, `validate` and `contributes`. Apart from functions, only JSON values go here.
 * - **The server** reads `server`: routes, hooks, formats, commands, migrations, feature flags and the labels of key uses, inline or as a loader (`() => import("my-plugin/server")`).
 *   A loader is read only when used, and the plugin package provides an empty browser entry point (the `browser` condition of `exports`) so server code stays out of the browser bundle.
 * - **The admin UI** reads `admin` (a loader), and **the public page** reads `render` (a loader).
 *
 * Every concept has one place: hooks only in `server`, API key slots only in `keySlots`.
 */
export interface CmsPlugin<
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
	 * (a row to pick a saved key or enter a new one, and to clear it again). The plugin reads its key with `cms.apiKeys.slot(<plugin name>, <slot id>).read()`.
	 * Uses of a key that are not slots (an item of the plugin that has its own key, like an AI connection) are reported with `cms.apiKeys.setUses` and labelled by `server.keyUses`.
	 */
	readonly keySlots?: readonly PluginKeySlot[];
	/** Validation called when the site config is created. Returns the issues it finds (a path into the config and a message each); `defineSite` reports them with every other problem. */
	// biome-ignore lint/suspicious/noConfusingVoidType: a plugin with nothing to report returns nothing
	readonly validate?: (config: PluginConfigView) => readonly Issue[] | void;
	/** Server side. Inline for a plugin that only needs hooks (it loads with every server start, so keep it light), or a loader for routes, commands and heavy code. */
	readonly server?: PluginServer;
	/** Admin UI side (pages, providers). The default export is the admin package's `CmsAdminPlugin`. */
	readonly admin?: () => Promise<{ readonly default: unknown }>;
	/**
	 * Public UI side (public components for body blocks). The module's named export `documentComponents` is `(context) => component table` of the document renderer
	 * (`renderDocument`: `blocks` and `marks` by block name, `codeTags`). `@monti-cms/core/render` calls it (`context`: site locale, image resolver). It is read on
	 * the server; the module marks client components with `"use client"`.
	 */
	readonly render?: () => Promise<{ readonly documentComponents?: unknown }>;
	/**
	 * What this plugin adds to other plugins. The key is a name chosen by the receiving side (e.g. the AI plugin reads `ai: { actions }`). The core reads one key itself, `layout`: the tabs of the edit screen's properties panel this plugin places its fields in (see `PluginPlacement`).
	 * It is unused if no plugin receives it, so an extension can add features without knowing the receiving plugin.
	 */
	readonly contributes?: Readonly<Record<string, unknown>>;
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
	 * Called after a key was assigned to the slot or the slot was cleared (in the admin, or by `cms.apiKeys.slot(...).set/assign`), once the change is saved. Use it
	 * for work that waits for the key (a sync that was held back for lack of a token). Not called for changes made inside `cms.transaction`.
	 */
	readonly onChange?: (cms: Cms) => Promise<void> | void;
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
	readonly plugins: readonly CmsPlugin[];
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
export const emptyServerPlugin: CmsServerPlugin = {};

export interface CmsServerPlugin {
	/**
	 * Looks up paths missing from the core routes in this route table. A route handler gets the instance it is served by in its context
	 * (`adminRoute(async ({ cms }) => ...)`), so a plugin reads the stores, its storage (`cms.storage(name)`) and its secrets (`cms.secrets(name)`) from `cms` and keeps no global state for them.
	 */
	readonly routes?: readonly PluginRoute[];
	/**
	 * Called by `monti db:migrate` after the core tables, with the plugin's own storage (`storage.once(name, step)` runs one-time work, e.g. moving data from an earlier layout).
	 * Must give the same result when called repeatedly. `cms` is the instance being migrated.
	 */
	readonly migrate?: (storage: PluginStorage, cms: Cms) => Promise<void>;
	/**
	 * What the admin shows for each item of this plugin that uses an API key (`cms.apiKeys.setUses(plugin, [{ ref, keyId }])`): the text for each `ref`, in the admin language
	 * (`cms.site.createTranslator`) and with the item's name as it is now, or `null` when the item does not exist any more (its use is dropped). Called whenever the keys are listed.
	 */
	readonly keyUses?: (cms: Cms, refs: readonly string[]) => Promise<Readonly<Record<string, string | null>>>;
	/** Value to put in `features.<plugin name>` of the admin meta API (`/v1/meta`). Does not mix with other plugins or core names. `cms` is the instance serving the request. */
	readonly features?: (cms: Cms) => Promise<Readonly<Record<string, boolean>>>;
	/**
	 * Hooks on every content write (same as the server config `hooks`): `transform`, `validate`, `validatePublish` and `afterCommit` (which gets the
	 * instance as its second argument, like the config's). They run after the server config's hooks, in the order of the plugins in the site config.
	 */
	readonly hooks?: WriteHooks;
	/**
	 * Formats this plugin adds (`@monti-cms/core/format`): notations the stored document can be written as and read from, picked with the `format` option of
	 * the read and write APIs. Called when the instance first needs its formats; two formats with one name (a plugin's and a built-in one included) fail there.
	 */
	readonly formats?: () => Promise<CmsFormat | readonly CmsFormat[]> | CmsFormat | readonly CmsFormat[];
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
 * Creates a plugin. A plugin package exports a function (e.g. `ai()`) that returns this value. The type of what it adds (`contributes`)
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
