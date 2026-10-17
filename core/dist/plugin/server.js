import { createFormatRegistry } from "../format/registry.js";
import { beforeSources, entrySubscribers } from "../services/reactions.js";
/** The server side of one plugin: the default export of its loader. `undefined` for a plugin without one. */
export async function serverSideOf(plugin) {
    return plugin.server ? (await plugin.server()).default : undefined;
}
/** `cms` is the instance that owns these plugins. The plugins' callbacks get it with their own context (`{ cms, plugin }`). */
export function createServerPlugins(plugins, serverConfig, cms) {
    let loaded;
    /** The server side of one plugin: the default export of its loader. */
    const loadOne = async (plugin) => {
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
    let formats;
    const loadFormats = () => {
        formats ??= load()
            .then((servers) => Promise.all(servers.map(async (server) => {
            const provided = await server.formats?.(scopeOf(server.name));
            return provided === undefined ? [] : Array.isArray(provided) ? provided : [provided];
        })))
            .then((lists) => createFormatRegistry(lists.flat()))
            .catch((error) => {
            formats = undefined;
            console.error("[cms] failed to load plugin formats", error);
            throw error;
        });
        return formats;
    };
    /** What a server callback of the plugin gets: the instance and the plugin's own context. */
    const scopeOf = (name) => {
        const instance = cms();
        return { cms: instance, plugin: instance.plugin(name) };
    };
    const writeHooks = async () => {
        const { on } = serverConfig();
        const sources = on ? beforeSources("server", on, () => ({ cms: cms() })) : [];
        for (const plugin of await load()) {
            if (plugin.on) {
                const name = plugin.name;
                sources.push(...beforeSources(`plugin:${name}`, plugin.on, () => scopeOf(name)));
            }
        }
        return sources;
    };
    return {
        load,
        formats: loadFormats,
        writeHooks,
        routes: async () => (await load()).flatMap((plugin) => (plugin.routes ?? []).map((route) => ({ ...route, plugin: plugin.name }))),
        features: async () => {
            const entries = await Promise.all((await load()).map(async (plugin) => {
                if (!plugin.features)
                    return undefined;
                try {
                    return [plugin.name, await plugin.features(scopeOf(plugin.name))];
                }
                catch {
                    return undefined;
                }
            }));
            return Object.fromEntries(entries.filter((entry) => entry !== undefined));
        },
        migrate: async (log = console.log) => {
            for (const plugin of await load()) {
                if (!plugin.migrate)
                    continue;
                log(`Updating the tables of plugin "${plugin.name}"\u2026`);
                await plugin.migrate(scopeOf(plugin.name));
            }
        },
        scopeOf,
        keySlotChanged: async (plugin, slot) => {
            const found = (await load()).find((entry) => entry.name === plugin);
            for (const handler of found?.on?.keySlot?.changed ?? [])
                await handler({ slot }, scopeOf(plugin));
        },
        eventSubscribers: async () => {
            const { on } = serverConfig();
            const subscribers = on ? entrySubscribers("server", on, () => ({ cms: cms() })) : [];
            for (const plugin of await load()) {
                if (plugin.on) {
                    const name = plugin.name;
                    subscribers.push(...entrySubscribers(`plugin:${name}`, plugin.on, () => scopeOf(name)));
                }
            }
            return subscribers;
        },
    };
}
