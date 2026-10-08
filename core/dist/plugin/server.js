import { createFormatRegistry } from "../format/registry.js";
/** `cms` is the instance that owns these plugins. It is passed to the plugin's `migrate` and `features`. */
export function createServerPlugins(plugins, serverConfig, cms) {
    let loaded;
    /** The server side of one plugin. Its `hooks` are the inline ones (`definePlugin({ hooks })`) or those of its `server` module, never both. */
    const loadOne = async (plugin) => {
        const server = (await plugin.server?.())?.default;
        if (plugin.hooks && server?.hooks) {
            throw new Error(`cms plugin "${plugin.name}": hooks are set both inline (definePlugin({ hooks })) and in its server module. Keep them in one place.`);
        }
        const hooks = plugin.hooks ?? server?.hooks;
        return { name: plugin.name, ...server, ...(hooks ? { hooks } : {}) };
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
        formats ??= Promise.all(plugins.map(async (plugin) => {
            const provided = (await plugin.formats?.())?.default;
            return provided === undefined ? [] : Array.isArray(provided) ? provided : [provided];
        }))
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
                log(`Migrating plugin "${plugin.name}"...`);
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
