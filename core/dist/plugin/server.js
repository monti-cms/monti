import { createFormatRegistry } from "../format/registry.js";
/** The server side of one plugin: its inline object, or the default export of its loader. `undefined` for a plugin without one. */
export async function serverSideOf(plugin) {
    return typeof plugin.server === "function" ? (await plugin.server()).default : plugin.server;
}
/** `cms` is the instance that owns these plugins. It is passed to the plugin's `migrate` and `features`. */
export function createServerPlugins(plugins, serverConfig, cms) {
    let loaded;
    /** The server side of one plugin: its inline object, or the default export of its loader. */
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
            const provided = await server.formats?.();
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
    const writeHooks = async () => {
        const { hooks } = serverConfig();
        const sources = hooks ? [{ owner: "server", hooks }] : [];
        for (const plugin of await load()) {
            if (plugin.hooks)
                sources.push({ owner: `plugin:${plugin.name}`, hooks: plugin.hooks });
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
                    return [plugin.name, await plugin.features(cms())];
                }
                catch {
                    return undefined;
                }
            }));
            return Object.fromEntries(entries.filter((entry) => entry !== undefined));
        },
        migrate: async (storageOf, log = console.log) => {
            for (const plugin of await load()) {
                if (!plugin.migrate)
                    continue;
                log(`Updating the tables of plugin "${plugin.name}"\u2026`);
                await plugin.migrate(storageOf(plugin.name), cms());
            }
        },
        eventSubscribers: async () => {
            const subscribers = [];
            for (const { owner, hooks } of await writeHooks()) {
                const { afterCommit } = hooks;
                if (afterCommit)
                    subscribers.push({ name: owner, handler: (event) => afterCommit(event, cms()) });
            }
            return subscribers;
        },
    };
}
