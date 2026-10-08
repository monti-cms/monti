import { type AuthGateway } from "../adapters/auth/auth-gateway.js";
import { type ContentStore, type Entry } from "../core/store/index.js";
import type { SaveDraftInput, ServiceInput } from "../core/types.js";
import type { FormatRegistry } from "../format/registry.js";
import type { MediaStore } from "../media/store.js";
import type { OwnedPluginRoute } from "../plugin/define.js";
import { type LoadedServerPlugin } from "../plugin/server.js";
import type { PluginStorage } from "../plugin/storage.js";
import { type CmsRead } from "../read/index.js";
import { type PluginSecrets, type PluginSecretsOptions } from "../secrets/index.js";
import type { Decision } from "../server/decision.js";
import type { CmsAuth, CmsServerConfig, RequestHost } from "../server/define.js";
import { createBulkService } from "../services/bulk-service.js";
import { createContentService } from "../services/content-service.js";
import { type CmsEvents } from "../services/events.js";
import type { HookSource } from "../services/hooks.js";
import { type AnyCmsConfig, type Site } from "../site/index.js";
/** The content service of any site: input is checked at run time only. */
type LooseContentService = ReturnType<typeof createContentService<Entry>>;
type IsAny<T> = 0 extends 1 & T ? true : false;
/**
 * The content service. With the config of the instance (`Cms<typeof config>` has `ContentService<typeof config>`), `createDraft` and `saveDraft` know the
 * collections and the metadata of each, and an item collection (a tag) needs no body. Without a config it takes any collection.
 */
export type ContentService<Config extends AnyCmsConfig = AnyCmsConfig> = Omit<LooseContentService, "createDraft" | "saveDraft"> & {
    createDraft(input: ServiceInput<IsAny<Config> extends true ? AnyCmsConfig : Config>, options?: {
        publishImmediately?: boolean;
    }): ReturnType<LooseContentService["createDraft"]>;
    saveDraft(entryId: string, input: SaveDraftInput<IsAny<Config> extends true ? AnyCmsConfig : Config>, options?: {
        publishImmediately?: boolean;
    }): ReturnType<LooseContentService["saveDraft"]>;
};
export type BulkService = ReturnType<typeof createBulkService<Entry>>;
/** Options of {@link Cms.handle}. */
export interface HandleOptions {
    /**
     * The path segments after the API prefix (`/api/cms/`), e.g. `["v1", "entries", "<id>"]`. By default they are read from the request URL.
     * A host that mounts the API somewhere else, or whose router already split the path, passes them here.
     */
    readonly path?: readonly string[];
}
/** The server config as plugins see it: everything but the master secrets and the event delivery settings (which hold the retry secret). */
export type PublicServerConfig = Omit<CmsServerConfig, "secret" | "previousSecrets" | "events">;
export interface CreateCmsOptions<Config extends AnyCmsConfig = AnyCmsConfig> {
    /**
     * The site config (`defineSite(...)` of `@monti-cms/core`, the data and plugins part of what `defineConfig` takes in `monti.config.ts`): collections, locales, blocks, plugins, admin and site settings. The instance holds it, and the store, the
     * services, the read API, the HTTP handler, the plugins, the admin and the renderer all get it from the instance. Its type is kept, so `cms.read` knows the
     * site's collection names and the shape of their metadata.
     */
    readonly config: Config;
    /** The server config: database, auth, media, secret, hooks, public API. */
    readonly server: CmsServerConfig;
    /**
     * Name of this instance, only used to find it again when a development server reloads modules (see {@link createCms}). Default `"default"`.
     * Give each instance its own id when one development process creates more than one.
     */
    readonly id?: string;
    /**
     * The schema file of a site whose config was made with `defineSite({ schema })` (path relative to the working directory). The settings screen edits it
     * and the dev server reads it again when it changes. Default: the path the config was given, else `monti.schema.json` (or `src/monti.schema.json`) in
     * the working directory.
     */
    readonly schemaFile?: string;
    /** Where the public site URL came from, for `monti doctor` (`defineConfig` knows: the config, the schema file or `SITE_URL`). */
    readonly siteUrlSource?: string;
}
/** What {@link Cms.reloadSchema} did. */
export interface SchemaReload {
    /** Whether the instance now runs the schema file as it is on disk. */
    readonly reloaded: boolean;
    /** Why not: `production` (instances do not reload there), `no_schema_file` (the config has none), or the message of the error in the file. */
    readonly reason?: string;
}
/**
 * A CMS instance. It owns everything the server side needs, built from the server config: the store, services, media store, login connection,
 * plugin server modules, write hooks, and the route handler and read API on top of them. Nothing is global: two instances with different
 * server configs live side by side in one process.
 *
 * Connections are created on first use, so creating the instance (at import or build time) connects to nothing.
 */
export interface Cms<Config extends AnyCmsConfig = any> {
    /**
     * The site of this instance, resolved from its config: collections and their rules, locales, URLs, blocks, code block settings, admin addresses and language.
     * Everything that used to be a module-level constant derived from the config is here. `cms.site.config` is the config the instance was created from.
     */
    readonly site: Site<Config>;
    /** The server config this instance was created from, without the master secrets (`secret`, `previousSecrets`): plugins reach those only through `secrets()`. */
    readonly server: PublicServerConfig;
    /** The content store. Created on first use. */
    store(): ContentStore;
    /** Content write operations (drafts, publishing, duplicates, translations). Runs the write hooks. */
    contentService(): ContentService<Config>;
    /** Bulk write operations. Runs the write hooks. */
    bulkService(): BulkService;
    /** Whether the server config has a media store. Without one, the admin hides the media menu and uploads. */
    readonly isMediaConfigured: boolean;
    /** The media store. Throws `media_not_configured` if the server config has none. */
    mediaStore(): MediaStore;
    /**
     * The storage of one plugin: documents in named collections with optimistic versions, and a migration hook (see `PluginStorage`). A plugin asks for its own
     * name (`cms.storage("my-plugin")`) and never sees the database behind it.
     */
    storage(plugin: string): PluginStorage;
    /**
     * The secrets API of one plugin: encryption of stored values and key derivation, with a key derived from the server config's `secret` and the plugin's
     * name. The master secret itself is never handed out. A plugin asks for its own name (`cms.secrets("ai")`); another plugin's values do not decrypt
     * with it. `options.legacy` lets the plugin keep reading values it stored in an older format.
     */
    secrets(plugin: string, options?: PluginSecretsOptions): PluginSecrets;
    /**
     * Gives the login the request headers of the framework serving this instance (Next.js: `nextHost`). `@monti-cms/nextjs` calls it from the route handler and the admin
     * layout and page, so a site never does. An explicit `host` of `auth()` wins over it.
     */
    attachHost(host: RequestHost): void;
    /** The login connection (`auth` in the server config): session, sign in and out, login methods, route handlers. */
    auth(): CmsAuth;
    /**
     * The login connection's route handlers, for an app whose login path is not the default (`/api/cms/auth`) and so needs its own route file:
     * `export const { GET, POST } = cms.authHandlers;`. The login connection is created on the first request.
     */
    readonly authHandlers: CmsAuth["handlers"];
    /** Admin check for requests and screens. Uses `auth()`. */
    readonly authGateway: AuthGateway;
    /** Whether `Host` and `X-Forwarded-Host` can be trusted (`trustHost` in the config, `AUTH_TRUST_HOST`, a known proxy platform, else off in production). */
    isHostTrusted(): boolean;
    /** The server side of the site config's plugins. Loaded on first use. */
    plugins(): Promise<readonly LoadedServerPlugin[]>;
    /** Plugin API route table (in plugin order). */
    pluginRoutes(): Promise<readonly OwnedPluginRoute[]>;
    /** Feature flags plugins add to the meta API, under each plugin's name. */
    pluginFeatures(): Promise<Record<string, Readonly<Record<string, boolean>>>>;
    /** Write hooks in the order they run: the server config's first, then the plugins'. */
    writeHooks(): Promise<readonly HookSource[]>;
    /**
     * The formats a body can be read and written in: the built-in ones, then those the plugins add (`CmsPlugin.formats`). Loaded on first use.
     * A name provided twice throws.
     */
    formats(): Promise<FormatRegistry>;
    /**
     * The delivery side of the event outbox: the committed changes the server config's and the plugins' `hooks.afterCommit` receive, retried when they fail.
     * `cms.events.retry()` delivers what is due (call it from a cron job, or use `monti events:retry`), `list`, `counts`, `retryDelivery` and `dismiss` are what the
     * admin's events screen uses.
     */
    readonly events: CmsEvents;
    /**
     * Serves one request of the admin API (`/api/cms/v1/*`), the login connection, the public API and the plugin routes. It takes a standard web
     * `Request` and returns a `Response`, so any host that speaks them can mount it. `@monti-cms/nextjs` mounts it in a Next.js route file (`createRouteHandler(cms)`). Unknown paths return 404 and a known
     * path with an unsupported method returns 405. The route code loads on the first request.
     */
    handle(request: Request, options?: HandleOptions): Promise<Response>;
    /** Reads published content for the site's pages, and resolves public media. */
    readonly read: CmsRead<Config>;
    /**
     * Creates the tables in the store, or brings them up to date (core tables, then plugin tables). Running it repeatedly gives the same result.
     * Throws on failure. It leaves the connection open; call `close()` when a command-line tool is done.
     */
    migrate(options?: {
        readonly log?: (message: string) => void;
    }): Promise<void>;
    /** Closes the database connection (when a command-line tool or a test is done). */
    close(): Promise<void>;
    /**
     * The absolute path of the schema file this instance was made from (and the settings screen edits), or `undefined` when its config has none (it is
     * written in code only) or the file cannot be found.
     */
    schemaFile(): string | undefined;
    /**
     * Another instance of the same site over a different schema (the parsed content of the schema file), sharing this instance's connections. It is not
     * installed: this instance keeps running the old schema. The settings screen uses it to check a change (diff, impact, a dry run of the transforms)
     * before the file is written. Throws what `defineSite` throws when the schema is not valid, and when the config has no schema file.
     */
    forSchema(schema: unknown): Cms<Config>;
    /**
     * Development only: reads the schema file again and makes this instance run it, in place (the same object, with a new site, store, services and read API).
     * The dev server calls it after the settings screen saved, and on its own when it finds the file changed on disk. A file that does not read or check
     * leaves the instance as it was and says why. In production it does nothing: a production server runs the schema it was built with.
     */
    reloadSchema(): SchemaReload;
    /**
     * What this instance decided on its own and why: the database and schema (and which environment variable they came from), the login, whether the development
     * bypass is on, whether the host is trusted, the site URL, the schema file and hot reload. `monti doctor` prints these.
     */
    decisions(env?: Readonly<Record<string, string | undefined>>): readonly Decision[];
}
/** The request handler of an instance, loading the route code on the first request. */
export declare function lazyHandle(cms: () => Cms): Cms["handle"];
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
export declare function createCms<const Config extends AnyCmsConfig>(options: CreateCmsOptions<Config>): Cms<Config>;
export {};
