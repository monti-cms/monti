import { CmsAuthGateway } from "../adapters/auth/auth-gateway.js";
import { resolveTrustHost } from "../adapters/auth/trust-host.js";
import { createApiKeys } from "../api-keys/api-keys.js";
import { problemText } from "../core/problem.js";
import { CmsError, withEventDispatch } from "../core/store/index.js";
import { API_KEYS_SCOPE, AUTH_SCOPE } from "../plugin/collisions.js";
import { createServerPlugins } from "../plugin/server.js";
import { createRead } from "../read/index.js";
import { createSecretsVault } from "../secrets/index.js";
import { createBulkService } from "../services/bulk-service.js";
import { createContentService } from "../services/content-service.js";
import { createEventDispatcher } from "../services/events.js";
import { createMediaService } from "../services/media-service.js";
import { mediaUrlResolver } from "../services/media-urls.js";
import { createPreferencesService } from "../services/preferences-service.js";
import { createSite } from "../site/index.js";
import { connectionsFor } from "./connections.js";
import { createMigrator } from "./migrate-run.js";
import { withSchemaControls } from "./reload.js";
/** The request handler of an instance, loading the route code on the first request. */
export function lazyHandle(cms) {
    let handler;
    return async (request, options) => {
        handler ??= import("../http/router.js").then((module) => module.createRequestHandler(cms()));
        return (await handler)(request, options);
    };
}
/**
 * Creates the CMS instance from a site config and a server config. An app does not call this: `defineConfig` of `@monti-cms/core/server` (what `monti.config.ts`
 * uses) takes the site options and the server options together and calls it. It stays for code that builds the two parts itself (tests, tools):
 *
 * ```ts
 * import { defineSite } from "@monti-cms/core"; // the site config only
 * export const cms = createCms({ config: defineSite({ schema, plugins }), server: { database: postgres(), auth: auth({ ... }) } });
 * ```
 *
 * Any number of instances live in one process, each with its own config and server config: nothing is read from a module or the environment except the
 * connections of the server config.
 */
export function createCms(options) {
    const { server, id = "default" } = options;
    const { secret, previousSecrets, events: eventOptions, ...publicServer } = server;
    const vault = createSecretsVault({ secret, previousSecrets });
    const connections = connectionsFor(id, server);
    const isHostTrusted = () => resolveTrustHost(server.trustHost);
    let attachedHost;
    /** Looks the attached host up when asked, so a login created before an integration attached itself still sees it. */
    const host = {
        requestHeaders: async () => (await attachedHost?.requestHeaders?.()) ?? null,
        rethrow: (error) => attachedHost?.rethrow?.(error),
    };
    /** Everything of an instance that depends on its site (its config): rebuilt when the schema changes. `self` is the instance the parts belong to. */
    const build = (config, self) => {
        const site = createSite(config);
        const plugins = createServerPlugins(site.plugins, () => server, 
        // The plugins and the handler take the instance as the loose `Cms`, whatever the type of its config.
        () => self());
        const keyLabels = async (plugin, refs) => {
            const owner = (await plugins.load()).find((candidate) => candidate.name === plugin);
            if (!owner?.keyUses)
                return Object.fromEntries(refs.map((ref) => [ref, plugin]));
            return owner.keyUses(self(), refs);
        };
        const declaredSlots = () => site.plugins.flatMap((plugin) => (plugin.keySlots ?? []).map((slot) => ({
            plugin: plugin.name,
            slot: slot.id,
            service: slot.service,
            label: typeof slot.label === "function" ? slot.label(site) : slot.label,
        })));
        const slotChanged = async (plugin, slot) => {
            const declared = site.plugins
                .find((entry) => entry.name === plugin)
                ?.keySlots?.find((entry) => entry.id === slot);
            await declared?.onChange?.(self());
        };
        const inTransaction = (work) => connections.database.transaction(work);
        const keysOn = (storage, transact, 
        /** A slot's `onChange` is called for changes made outside a transaction only: inside one, the change is not saved yet. */
        notify = true) => createApiKeys({
            storage,
            secrets: vault.forPlugin(API_KEYS_SCOPE),
            labels: keyLabels,
            declared: declaredSlots,
            ...(notify ? { onSlotChange: slotChanged } : {}),
            ...(transact ? { transact } : {}),
        });
        const apiKeys = keysOn(() => connections.database.pluginStorage(API_KEYS_SCOPE), (work) => inTransaction((tx) => work(() => tx.pluginStorage(API_KEYS_SCOPE))));
        /** What `cms.plugin(name).once` made. It belongs to this build, so a schema reload (a new build) starts it empty. */
        const pluginValues = new Map();
        let store;
        let service;
        let bulk;
        let media;
        let preferences;
        let auth;
        const getAuth = () => {
            auth ??= server.auth.create({
                site,
                loginPath: site.adminUrl("/login"),
                trustHost: isHostTrusted(),
                secrets: vault.forPlugin(AUTH_SCOPE),
                host,
                storage: (plugin) => connections.database.pluginStorage(plugin),
            });
            return auth;
        };
        let rawStore;
        const getRawStore = () => {
            rawStore ??= connections.database.createStore({ site });
            return rawStore;
        };
        const dispatcher = createEventDispatcher({
            ...eventOptions,
            store: getRawStore,
            subscribers: plugins.eventSubscribers,
        });
        // Every write goes through the dispatcher: the store writes the events in the transaction of the change, the wrapper delivers them after the commit.
        const getStore = () => {
            store ??= withEventDispatch(getRawStore(), dispatcher.dispatchEntry);
            return store;
        };
        const getMediaStore = () => {
            if (!server.media) {
                throw new CmsError(problemText({
                    what: "Media storage is not configured, so there is nowhere to keep uploads",
                    where: "`storage` in monti.config.ts",
                    fix: "add a storage adapter, for example `storage: s3Storage()` (@monti-cms/storage-s3, which reads the S3_* values)",
                }), "media_not_configured");
            }
            connections.mediaStore ??= server.media.createStore();
            return connections.mediaStore;
        };
        const authGateway = new CmsAuthGateway(getAuth);
        /** What a publish looks up for its image warnings. The stored file is checked once more when a media store is configured. */
        const imageChecks = () => ({
            getMediaAsset: (mediaId) => getStore().getMediaAsset(mediaId),
            ...(server.media
                ? {
                    headStorageKey: async (storageKey) => {
                        try {
                            return (await getMediaStore().headFile({ key: storageKey })) !== null;
                        }
                        catch {
                            // Store config and outages fall back to the DB result (non-blocking).
                            return true;
                        }
                    },
                }
                : {}),
        });
        return {
            site,
            server: publicServer,
            store: getStore,
            contentService: () => {
                service ??= createContentService(getStore(), {
                    site,
                    hooks: plugins.writeHooks,
                    formats: plugins.formats,
                    ...(server.media ? { media: mediaUrlResolver(getStore, getMediaStore) } : {}),
                    imageChecks: imageChecks(),
                });
                return service;
            },
            bulkService: () => {
                bulk ??= createBulkService(getStore(), {
                    site,
                    hooks: plugins.writeHooks,
                    formats: plugins.formats,
                    ...(server.media ? { media: mediaUrlResolver(getStore, getMediaStore) } : {}),
                    imageChecks: imageChecks(),
                });
                return bulk;
            },
            mediaService: () => {
                media ??= createMediaService({ store: getStore, mediaStore: getMediaStore });
                return media;
            },
            preferencesService: () => {
                preferences ??= createPreferencesService(site, getStore);
                return preferences;
            },
            isMediaConfigured: Boolean(server.media),
            mediaStore: getMediaStore,
            storage: (plugin) => connections.database.pluginStorage(plugin),
            plugin: (name) => ({
                name,
                // Read when asked, so a plugin that needs only one of them does not open a connection for the others.
                get storage() {
                    return connections.database.pluginStorage(name);
                },
                get secrets() {
                    return vault.forPlugin(name);
                },
                apiKeys,
                once: (key, factory) => {
                    const id = `${name}/${key}`;
                    if (!pluginValues.has(id))
                        pluginValues.set(id, factory());
                    return pluginValues.get(id);
                },
            }),
            secrets: (plugin) => vault.forPlugin(plugin),
            apiKeys,
            transaction: (work) => inTransaction((tx) => work({
                storage: (plugin) => tx.pluginStorage(plugin),
                apiKeys: keysOn(() => tx.pluginStorage(API_KEYS_SCOPE), undefined, false),
            })),
            auth: getAuth,
            authHandlers: {
                GET: (request) => getAuth().handlers.GET(request),
                POST: (request) => getAuth().handlers.POST(request),
            },
            authGateway,
            isHostTrusted,
            attachHost: (next) => {
                attachedHost = next;
            },
            plugins: plugins.load,
            pluginRoutes: plugins.routes,
            pluginFeatures: plugins.features,
            writeHooks: plugins.writeHooks,
            formats: plugins.formats,
            events: dispatcher.events,
            handle: lazyHandle(() => self()),
            read: createRead({
                site,
                store: getStore,
                mediaStore: getMediaStore,
                formats: plugins.formats,
                verifyAdmin: () => authGateway.verifyAdmin(),
            }),
            ...createMigrator({ connections, site, plugins }),
            close: async () => {
                await connections.database.close?.();
            },
        };
    };
    return withSchemaControls({ options, server, build });
}
