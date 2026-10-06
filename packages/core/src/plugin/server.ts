import type { ContentChange } from "../adapters/postgres/store/after-commit";
import { cmsConfig } from "../config/resolved";
import type { CmsServerConfig } from "../server/define";
import { cmsServerConfig } from "../server/resolved";
import type { HookSource } from "../services/hooks";
import type { CmsPlugin, CmsServerPlugin, OwnedPluginRoute, PluginDatabase } from "./define";

/** Plugins of the site config. A config without plugins has an empty tuple type, so it is widened for reading. */
const PLUGINS: readonly CmsPlugin[] = cmsConfig.plugins ?? [];

/**
 * Loads the server side of the site config's plugins. Read once on the first call and reused afterwards.
 * A plugin without a server side is empty. If loading fails, it is not remembered so the next call retries, and the error is rethrown as is.
 */
let loaded: Promise<readonly (CmsServerPlugin & { readonly name: string })[]> | undefined;

export function loadServerPlugins(): Promise<readonly (CmsServerPlugin & { readonly name: string })[]> {
	loaded ??= Promise.all(
		PLUGINS.map(async (plugin) => ({ name: plugin.name, ...(await plugin.server?.())?.default })),
	).catch((error) => {
		loaded = undefined;
		console.error("[cms] failed to load plugin server modules", error);
		throw error;
	});
	return loaded;
}

/** Plugin API route table (in plugin order, tagged with the plugin each route belongs to). */
export async function pluginRoutes(): Promise<readonly OwnedPluginRoute[]> {
	return (await loadServerPlugins()).flatMap((plugin) =>
		(plugin.routes ?? []).map((route) => ({ ...route, plugin: plugin.name })),
	);
}

/** DB connection used by plugins. */
export const getCmsDatabase = (): PluginDatabase => cmsServerConfig.database.pluginDatabase();

/** Creates the plugin tables. Called after the core tables are created (`monti migrate`). */
export async function migratePlugins(): Promise<void> {
	for (const plugin of await loadServerPlugins()) {
		if (!plugin.migrate) continue;
		console.log(`Migrating plugin "${plugin.name}"...`);
		await plugin.migrate(getCmsDatabase());
	}
}

/**
 * Collects the feature flags plugins add to the meta API under each plugin's name (`{ ai: { ... } }`).
 * Plugins with no feature flags, or that fail, are left out.
 */
export async function pluginFeatures(): Promise<Record<string, Readonly<Record<string, boolean>>>> {
	const plugins = await loadServerPlugins();
	const entries = await Promise.all(
		plugins.map(async (plugin) => {
			if (!plugin.features) return undefined;
			try {
				return [plugin.name, await plugin.features()] as const;
			} catch {
				return undefined;
			}
		}),
	);
	return Object.fromEntries(entries.filter((entry) => entry !== undefined));
}

/**
 * Write hooks in the order they run: the server config first, then the plugins in the site config's order. Each is tagged with its owner
 * (`server`, `plugin:<name>`), which a failing hook is reported with.
 */
export async function loadWriteHooks(): Promise<readonly HookSource[]> {
	const serverConfig: CmsServerConfig = cmsServerConfig;
	const sources: HookSource[] = serverConfig.hooks ? [{ owner: "server", hooks: serverConfig.hooks }] : [];
	for (const plugin of await loadServerPlugins()) {
		if (plugin.hooks) sources.push({ owner: `plugin:${plugin.name}`, hooks: plugin.hooks });
	}
	return sources;
}

/** Calls the server config's and the plugins' after-save notifications in turn (the rest are still called if one fails). */
export async function notifyAfterCommit(change: ContentChange): Promise<void> {
	for (const { owner, hooks } of await loadWriteHooks()) {
		if (!hooks.afterCommit) continue;
		try {
			await hooks.afterCommit(change);
		} catch (error) {
			console.error(`[cms] afterCommit of ${owner} failed`, change.kind, change.entryId, error);
		}
	}
}
