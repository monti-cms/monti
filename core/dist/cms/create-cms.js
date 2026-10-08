import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { CmsAuthGateway } from "../adapters/auth/auth-gateway.js";
import { explainTrustHost, resolveTrustHost } from "../adapters/auth/trust-host.js";
import { findSchemaFile } from "../cli/schema-types.js";
import { problemText } from "../core/problem.js";
import { CmsError, withEventDispatch } from "../core/store/index.js";
import { createServerPlugins } from "../plugin/server.js";
import { createRead } from "../read/index.js";
import { readSchemaFile } from "../schema-file/read.js";
import { schemaSourceOf } from "../schema-file/source.js";
import { createSecretsVault } from "../secrets/index.js";
import { createBulkService } from "../services/bulk-service.js";
import { createContentService } from "../services/content-service.js";
import { createEventDispatcher } from "../services/events.js";
import { mediaUrlResolver } from "../services/media-urls.js";
import { createSite } from "../site/index.js";
import { coreDecisions } from "./decisions.js";
const DEV_CONNECTIONS = Symbol.for("monti.cms.dev-connections");
function connectionsFor(id, server) {
    if (process.env.NODE_ENV !== "development")
        return { database: server.database };
    const global = globalThis;
    const registry = global[DEV_CONNECTIONS] ?? new Map();
    global[DEV_CONNECTIONS] = registry;
    let connections = registry.get(id);
    if (!connections) {
        connections = { database: server.database };
        registry.set(id, connections);
    }
    return connections;
}
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
        let store;
        let service;
        let bulk;
        let auth;
        const getAuth = () => {
            auth ??= server.auth.create({
                site,
                loginPath: site.adminUrl("/login"),
                trustHost: isHostTrusted(),
                secrets: vault.forPlugin("auth"),
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
            // The marks of `event.once` live in the plugin storage, under a name no plugin can take (`CORE_FEATURE_KEYS`).
            marks: () => connections.database.pluginStorage("core-events").collection("once"),
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
                });
                return service;
            },
            bulkService: () => {
                bulk ??= createBulkService(getStore(), {
                    site,
                    hooks: plugins.writeHooks,
                    formats: plugins.formats,
                    ...(server.media ? { media: mediaUrlResolver(getStore, getMediaStore) } : {}),
                });
                return bulk;
            },
            isMediaConfigured: Boolean(server.media),
            mediaStore: getMediaStore,
            storage: (plugin) => connections.database.pluginStorage(plugin),
            secrets: (plugin, secretsOptions) => vault.forPlugin(plugin, secretsOptions),
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
            migrate: async ({ log = console.log } = {}) => {
                const target = connections.database.describeTarget?.();
                log(`Migrating the ${connections.database.name} database${target ? `: ${target}` : ""}`);
                const summary = await connections.database.migrate({ site, formats: await plugins.formats() });
                await plugins.migrate((plugin) => connections.database.pluginStorage(plugin), log);
                log(summary
                    ? `Applied ${summary.applied} step${summary.applied === 1 ? "" : "s"}, ${summary.upToDate} already up to date.`
                    : "Migration completed.");
            },
            close: async () => {
                await connections.database.close?.();
            },
        };
    };
    const source = schemaSourceOf(options.config);
    /** The schema file of the config, found on first use (creating the instance does no file access). */
    let schemaPath;
    const schemaFile = () => {
        if (schemaPath === undefined) {
            schemaPath = null;
            const given = options.schemaFile ?? source?.file;
            if (source) {
                try {
                    schemaPath = path.resolve(process.cwd(), given ?? findSchemaFile(process.cwd()));
                    if (!existsSync(schemaPath))
                        schemaPath = null;
                }
                catch {
                    schemaPath = null;
                }
            }
        }
        return schemaPath ?? undefined;
    };
    const forSchema = (schema) => {
        if (!source)
            throw new Error("cms: this instance's config has no schema file (it is not made with `defineSite({ schema })`)");
        const next = source.rebuild(schema);
        const detached = {
            ...build(next, () => detached),
            schemaFile,
            forSchema: (other) => cms.forSchema(other),
            reloadSchema: () => ({ reloaded: false, reason: "detached" }),
            decisions: (env) => cms.decisions(env),
        };
        return detached;
    };
    // The part of the instance that changes when the schema is reloaded. `site` is read through a getter that also finds a schema file edited on disk.
    let current = build(options.config, () => cms);
    let stamp;
    let checkedAt = Number.NEGATIVE_INFINITY;
    const stampOf = (file) => {
        try {
            const stat = statSync(file);
            return `${stat.mtimeMs}:${stat.size}`;
        }
        catch {
            return undefined;
        }
    };
    let reported;
    const reloadSchema = () => {
        if (process.env.NODE_ENV !== "development")
            return { reloaded: false, reason: "production" };
        const file = schemaFile();
        if (!source || !file)
            return { reloaded: false, reason: "no_schema_file" };
        stamp = stampOf(file);
        try {
            const next = build(source.rebuild(readSchemaFile(file)), () => cms);
            const { site: _site, ...parts } = next;
            current = next;
            Object.assign(cms, parts);
            reported = undefined;
            return { reloaded: true };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            // A schema that is half written or invalid is reported once; the instance keeps running the last good one until the file changes again.
            if (message !== reported)
                console.error(`monti: the schema file was not reloaded: ${message}`);
            reported = message;
            return { reloaded: false, reason: message };
        }
    };
    /** In development, runs the schema file again when it changed on disk since the instance last read it (a hand edit, or a save from another process). */
    const refresh = () => {
        if (process.env.NODE_ENV !== "development" || !source)
            return;
        // A monotonic clock, not `Date.now()`: Next's Cache Components rejects the wall clock in a render (this runs on every `cms.site` read, in a layout or a page).
        const now = performance.now();
        if (now - checkedAt < 250)
            return;
        checkedAt = now;
        const file = schemaFile();
        if (!file)
            return;
        const seen = stampOf(file);
        if (stamp === undefined)
            stamp = seen;
        else if (seen !== undefined && seen !== stamp)
            reloadSchema();
    };
    const decisions = (env = process.env) => {
        const file = schemaFile();
        return [
            ...(server.database.decisions?.(env) ?? []),
            ...(server.auth.decisions?.(env) ?? []),
            ...coreDecisions({
                env,
                trust: explainTrustHost(server.trustHost, env),
                siteUrl: current.site.config.site?.url,
                siteUrlSource: options.siteUrlSource,
                schemaFile: file ? path.relative(process.cwd(), file) || file : undefined,
                schemaFileGiven: Boolean(options.schemaFile ?? source?.file),
                hotReload: env.NODE_ENV === "development" && Boolean(source && file),
            }),
        ];
    };
    const { site: _first, ...rest } = current;
    const cms = Object.defineProperties({ ...rest, schemaFile, forSchema, reloadSchema, decisions }, {
        site: {
            enumerable: true,
            get: () => {
                refresh();
                return current.site;
            },
        },
    });
    return cms;
}
