import type { Cms } from "../cms";
import { createFormatRegistry, type FormatRegistry } from "../format/registry";
import type { CmsFormat } from "../format/types";
import type { CmsServerConfig } from "../server/define";
import type { EventSubscriber } from "../services/events";
import { bindHooks, type HookSource, type PluginScope } from "../services/hooks";
import type { OwnedPluginRoute, Plugin, ServerPlugin } from "./define";

/** The server side of one plugin: its inline object, or the default export of its loader. `undefined` for a plugin without one. */
export async function serverSideOf(plugin: Pick<Plugin, "server">): Promise<ServerPlugin | undefined> {
	return typeof plugin.server === "function" ? (await plugin.server()).default : plugin.server;
}

/** The server side of a plugin, with the plugin's name. A plugin without a server side is empty. */
export type LoadedServerPlugin = ServerPlugin & { readonly name: string };

/**
 * The server side of one site's plugins, owned by one CMS instance (`createCms`): the loaded server modules, the route table, feature flags,
 * migrations, and the write hooks that run in order (server config first, then plugins).
 */
export interface ServerPlugins {
	/**
	 * Loads the server side of the plugins. Read once on the first call and reused afterwards.
	 * If loading fails, it is not remembered so the next call retries, and the error is rethrown as is.
	 */
	load(): Promise<readonly LoadedServerPlugin[]>;
	/**
	 * The formats of the instance: the built-in ones, then those of the plugins in the site config's order. Read once on the first call and reused afterwards.
	 * A name provided twice fails here, and the failure is not remembered.
	 */
	formats(): Promise<FormatRegistry>;
	/** Plugin API route table (in plugin order, tagged with the plugin each route belongs to). */
	routes(): Promise<readonly OwnedPluginRoute[]>;
	/**
	 * Collects the feature flags plugins add to the meta API under each plugin's name (`{ ai: { ... } }`).
	 * Plugins with no feature flags, or that fail, are left out.
	 */
	features(): Promise<Record<string, Readonly<Record<string, boolean>>>>;
	/** Runs each plugin's migration hook with its scope (its storage is `plugin.storage`). Called after the core tables are created (`monti db:migrate`). */
	migrate(log?: (message: string) => void): Promise<void>;
	/** What a server callback of the named plugin gets: the instance and the plugin's own context. */
	scopeOf(name: string): PluginScope;
	/**
	 * Write hooks in the order they run: the server config first, then the plugins in the site config's order. Each is tagged with its owner
	 * (`server`, `plugin:<name>`), which a failing hook is reported with.
	 */
	writeHooks(): Promise<readonly HookSource[]>;
	/**
	 * The subscribers of the committed changes, in the order they are delivered to: the server config's `hooks.afterCommit`, then each plugin's. The name
	 * is the hook's owner (`server`, `plugin:<name>`) and keys the delivery state of the outbox.
	 */
	eventSubscribers(): Promise<readonly EventSubscriber[]>;
}

/** `cms` is the instance that owns these plugins. The plugins' callbacks get it with their own context (`{ cms, plugin }`). */
export function createServerPlugins(
	plugins: readonly Plugin[],
	serverConfig: () => Pick<CmsServerConfig, "hooks">,
	cms: () => Cms,
): ServerPlugins {
	let loaded: Promise<readonly LoadedServerPlugin[]> | undefined;

	/** The server side of one plugin: its inline object, or the default export of its loader. */
	const loadOne = async (plugin: Plugin): Promise<LoadedServerPlugin> => {
		return { name: plugin.name, ...(await serverSideOf(plugin)) };
	};

	const load = () => {
		loaded ??= Promise.all(plugins.map(loadOne)).catch((error) => {
			loaded = undefined;
			console.error("[cms] failed to load plugin server modules", error);
			throw error;
		});
		return loaded;
	};

	let formats: Promise<FormatRegistry> | undefined;
	const loadFormats = () => {
		formats ??= load()
			.then((servers) =>
				Promise.all(
					servers.map(async (server) => {
						const provided = await server.formats?.();
						return provided === undefined ? [] : Array.isArray(provided) ? provided : [provided as CmsFormat];
					}),
				),
			)
			.then((lists) => createFormatRegistry(lists.flat()))
			.catch((error) => {
				formats = undefined;
				console.error("[cms] failed to load plugin formats", error);
				throw error;
			});
		return formats;
	};

	/** What a server callback of the plugin gets: the instance and the plugin's own context. */
	const scopeOf = (name: string): PluginScope => {
		const instance = cms();
		return { cms: instance, plugin: instance.plugin(name) };
	};

	const writeHooks = async (): Promise<readonly HookSource[]> => {
		const { hooks } = serverConfig();
		const sources: HookSource[] = hooks ? [{ owner: "server", hooks: bindHooks(hooks, () => ({ cms: cms() })) }] : [];
		for (const plugin of await load()) {
			if (plugin.hooks) {
				const name = plugin.name;
				sources.push({ owner: `plugin:${name}`, hooks: bindHooks(plugin.hooks, () => scopeOf(name)) });
			}
		}
		return sources;
	};

	return {
		load,
		formats: loadFormats,
		writeHooks,
		routes: async () =>
			(await load()).flatMap((plugin) => (plugin.routes ?? []).map((route) => ({ ...route, plugin: plugin.name }))),
		features: async () => {
			const entries = await Promise.all(
				(await load()).map(async (plugin) => {
					if (!plugin.features) return undefined;
					try {
						return [plugin.name, await plugin.features(scopeOf(plugin.name))] as const;
					} catch {
						return undefined;
					}
				}),
			);
			return Object.fromEntries(entries.filter((entry) => entry !== undefined));
		},
		migrate: async (log = console.log) => {
			for (const plugin of await load()) {
				if (!plugin.migrate) continue;
				log(`Updating the tables of plugin "${plugin.name}"\u2026`);
				await plugin.migrate(scopeOf(plugin.name));
			}
		},
		scopeOf,
		eventSubscribers: async () => {
			const subscribers: EventSubscriber[] = [];
			for (const { owner, hooks } of await writeHooks()) {
				const { afterCommit } = hooks;
				if (afterCommit) subscribers.push({ name: owner, handler: afterCommit });
			}
			return subscribers;
		},
	};
}
