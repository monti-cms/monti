import type { Cms } from "../cms";
import type { AfterCommit } from "../core/store";
import { createFormatRegistry, type FormatRegistry } from "../format/registry";
import type { CmsFormat } from "../format/types";
import type { CmsServerConfig } from "../server/define";
import type { EventSubscriber } from "../services/events";
import type { HookSource } from "../services/hooks";
import type { CmsPlugin, CmsServerPlugin, OwnedPluginRoute } from "./define";
import type { PluginStorage } from "./storage";

/** The server side of a plugin, with the plugin's name. A plugin without a server side is empty. */
export type LoadedServerPlugin = CmsServerPlugin & { readonly name: string };

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
	/** Runs each plugin's migration hook with that plugin's storage. Called after the core tables are created (`monti migrate`). */
	migrate(storageOf: (plugin: string) => PluginStorage, log?: (message: string) => void): Promise<void>;
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

/** `cms` is the instance that owns these plugins. It is passed to the plugin's `migrate` and `features`. */
export function createServerPlugins(
	plugins: readonly CmsPlugin[],
	serverConfig: () => Pick<CmsServerConfig, "hooks">,
	cms: () => Cms,
): ServerPlugins {
	let loaded: Promise<readonly LoadedServerPlugin[]> | undefined;

	const load = () => {
		loaded ??= Promise.all(
			plugins.map(async (plugin) => ({ name: plugin.name, ...(await plugin.server?.())?.default })),
		).catch((error) => {
			loaded = undefined;
			console.error("[cms] failed to load plugin server modules", error);
			throw error;
		});
		return loaded;
	};

	let formats: Promise<FormatRegistry> | undefined;
	const loadFormats = () => {
		formats ??= Promise.all(
			plugins.map(async (plugin) => {
				const provided = (await plugin.formats?.())?.default;
				return provided === undefined ? [] : Array.isArray(provided) ? provided : [provided as CmsFormat];
			}),
		)
			.then((lists) => createFormatRegistry(lists.flat()))
			.catch((error) => {
				formats = undefined;
				console.error("[cms] failed to load plugin formats", error);
				throw error;
			});
		return formats;
	};

	const writeHooks = async (): Promise<readonly HookSource[]> => {
		const { hooks } = serverConfig();
		const sources: HookSource[] = hooks ? [{ owner: "server", hooks }] : [];
		for (const plugin of await load()) {
			if (plugin.hooks) sources.push({ owner: `plugin:${plugin.name}`, hooks: plugin.hooks });
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
						return [plugin.name, await plugin.features(cms())] as const;
					} catch {
						return undefined;
					}
				}),
			);
			return Object.fromEntries(entries.filter((entry) => entry !== undefined));
		},
		migrate: async (storageOf, log = console.log) => {
			for (const plugin of await load()) {
				if (!plugin.migrate) continue;
				log(`Migrating plugin "${plugin.name}"...`);
				await plugin.migrate(storageOf(plugin.name), cms());
			}
		},
		eventSubscribers: async () => {
			const hooked = new Map((await writeHooks()).map(({ owner, hooks }) => [owner, hooks.afterCommit] as const));
			const subscribers: { name: string; handler: AfterCommit }[] = [];
			const server = hooked.get("server");
			if (server) subscribers.push({ name: "server", handler: server });
			for (const plugin of await load()) {
				const name = `plugin:${plugin.name}`;
				const hook = hooked.get(name);
				const { afterCommit } = plugin;
				if (!hook && !afterCommit) continue;
				if (!afterCommit && hook) {
					subscribers.push({ name, handler: hook });
					continue;
				}
				// A subscriber that wants the instance: runs the plain hook first when the plugin has one too.
				subscribers.push({
					name,
					handler: async (event) => {
						await hook?.(event);
						await afterCommit?.(event, cms());
					},
				});
			}
			return subscribers;
		},
	};
}
