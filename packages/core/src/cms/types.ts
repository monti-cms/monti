import type { AuthGateway } from "../adapters/auth/auth-gateway";
import type { ApiKeys } from "../api-keys/api-keys";
import type { CmsConfig } from "../config/define";
import type { ContentStore } from "../core/store";
import type { SaveDraftInput, ServiceInput } from "../core/types";
import type { FormatRegistry } from "../format/registry";
import type { MediaStore } from "../media/store";
import type { PluginContext } from "../plugin/context";
import type { OwnedPluginRoute } from "../plugin/define";
import type { LoadedServerPlugin } from "../plugin/server";
import type { PluginStorage } from "../plugin/storage";
import type { CmsRead } from "../read";
import type { PluginSecrets } from "../secrets";
import type { Decision } from "../server/decision";
import type { CmsAuth, CmsServerConfig, DatabaseState, RequestHost } from "../server/define";
import type { createBulkService } from "../services/bulk-service";
import type { createContentService } from "../services/content-service";
import type { CmsEvents } from "../services/events";
import type { HookSource } from "../services/hooks";
import type { MediaService } from "../services/media-service";
import type { PreferencesService } from "../services/preferences-service";
import type { Site } from "../site";

/** The content service of any site: input is checked at run time only. */
export type LooseContentService = ReturnType<typeof createContentService>;

type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * The content service. With the config of the instance (`Cms<typeof config>` has `ContentService<typeof config>`), `createDraft` and `saveDraft` know the
 * collections and the metadata of each, and an item collection (a tag) needs no body. Without a config it takes any collection.
 */
export type ContentService<Config extends CmsConfig = CmsConfig> = Omit<
	LooseContentService,
	"createDraft" | "saveDraft"
> & {
	createDraft(
		input: ServiceInput<IsAny<Config> extends true ? CmsConfig : Config>,
		options?: { publishImmediately?: boolean },
	): ReturnType<LooseContentService["createDraft"]>;
	saveDraft(
		entryId: string,
		input: SaveDraftInput<IsAny<Config> extends true ? CmsConfig : Config>,
		options?: { publishImmediately?: boolean },
	): ReturnType<LooseContentService["saveDraft"]>;
};
export type BulkService = ReturnType<typeof createBulkService>;

/** Options of {@link Cms.handle}. */
export interface HandleOptions {
	/**
	 * The path segments after the API prefix (`/api/monti/`), e.g. `["v1", "entries", "<id>"]`. By default they are read from the request URL.
	 * A host that mounts the API somewhere else, or whose router already split the path, passes them here.
	 */
	readonly path?: readonly string[];
}

/** The server config as plugins see it: everything but the master secrets and the event delivery settings (which hold the retry secret). */
export type PublicServerConfig = Omit<CmsServerConfig, "secret" | "previousSecrets" | "events">;

export interface CreateCmsOptions<Config extends CmsConfig = CmsConfig> {
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
	 * The schema file of a site whose config was made with `defineSite({ schema })` (path relative to the working directory). The settings screen edits it.
	 * Default: `monti.schema.ts` (or `src/monti.schema.ts`) in the working directory.
	 */
	readonly schemaFile?: string;
	/** Where the public site URL came from, for `monti doctor` (`defineConfig` knows: the config, the schema file or `SITE_URL`). */
	readonly siteUrlSource?: string;
}

/** What {@link Cms.reloadSchema} did. */
export interface SchemaReload {
	/** Whether the instance now runs the schema it was given. */
	readonly reloaded: boolean;
	/** Why not: `production` (instances do not reload there), `no_schema_file` (the config has none), or the message of the error in the schema. */
	readonly reason?: string;
}

/** What `cms.transaction` hands the work: the storage of any plugin and the API key store, all inside one transaction. */
export interface CmsTransaction {
	storage(plugin: string): PluginStorage;
	readonly apiKeys: ApiKeys;
}

/** What `cms.migrate()` takes. */
export interface MigrateRunOptions {
	readonly log?: (message: string) => void;
}

/**
 * A CMS instance. It owns everything the server side needs, built from the server config: the store, services, media store, login connection,
 * plugin server modules, write hooks, and the route handler and read API on top of them. Nothing is global: two instances with different
 * server configs live side by side in one process.
 *
 * Connections are created on first use, so creating the instance (at import or build time) connects to nothing.
 */
export interface Cms<
	// biome-ignore lint/suspicious/noExplicitAny: `Cms` alone is an instance of any site config
	Config extends CmsConfig = any,
> {
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
	/** Deleting media files and cleaning up uploads that never completed. */
	mediaService(): MediaService;
	/** The admin's saved settings (list columns, sort, editor layout), per user. */
	preferencesService(): PreferencesService;
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
	 * What one plugin keeps for this instance: its storage, secrets, the key store and a cache that is rebuilt with the site (`PluginContext`). A plugin asks for its
	 * own name (`cms.plugin("my-plugin")`).
	 */
	plugin(name: string): PluginContext;
	/**
	 * The secrets API of one plugin: encryption of stored values and key derivation, with a key derived from the server config's `secret` and the plugin's
	 * name. The master secret itself is never handed out. A plugin asks for its own name (`cms.secrets("ai")`); another plugin's values do not decrypt
	 * with it. `options.legacy` lets the plugin keep reading values it stored in an older format.
	 */
	secrets(plugin: string): PluginSecrets;
	/**
	 * The central API key store: named keys kept encrypted, with the places that use each. A plugin keeps a key's id (not its value) and reads the value with
	 * `cms.apiKeys.read(id)` when it calls a service; see {@link ApiKeys}. The admin's Tools → API keys page manages the same keys.
	 */
	readonly apiKeys: ApiKeys;
	/**
	 * Runs `work` in one database transaction: everything written through `tx` (any plugin's storage, and the API key store) is kept together, and nothing of it
	 * if `work` throws. Use it to create a key and the item that uses it in one step: `tx.apiKeys.choose(...)` then write the item with `tx.storage("my-plugin")`.
	 * `once` is not available on `tx.storage`.
	 */
	transaction<T>(work: (tx: CmsTransaction) => Promise<T>): Promise<T>;
	/**
	 * Gives the login the request headers of the framework serving this instance (Next.js: `nextHost`). `@monti-cms/nextjs` calls it from the route handler and the admin
	 * layout and page, so a site never does. An explicit `host` of `auth()` wins over it.
	 */
	attachHost(host: RequestHost): void;
	/** The login connection (`auth` in the server config): session, sign in and out, login methods, route handlers. */
	auth(): CmsAuth;
	/**
	 * The login connection's route handlers, for an app whose login path is not the default (`/api/monti/auth`) and so needs its own route file:
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
	 * Serves one request of the admin API (`/api/monti/v1/*`), the login connection, the public API and the plugin routes. It takes a standard web
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
	migrate(options?: MigrateRunOptions): Promise<void>;
	/** What the database holds of Monti (`undefined` when the adapter cannot say). `monti db:migrate` reads it to tell a database that was never set up. */
	databaseState(): Promise<DatabaseState | undefined>;
	/**
	 * First-time setup (`monti db:setup`): creates the tables in an empty database, or says Monti is already set up there and changes nothing.
	 * Throws on failure. It leaves the connection open; call `close()` when a command-line tool is done.
	 */
	setup(options?: {
		readonly log?: (message: string) => void;
	}): Promise<{ readonly created: boolean; readonly tables: number }>;
	/** Closes the database connection (when a command-line tool or a test is done). */
	close(): Promise<void>;
	/**
	 * The absolute path of the schema file this instance was made from (and the settings screen edits), or `undefined` when its config has none (it is
	 * written in code only) or the file cannot be found.
	 */
	schemaFile(): string | undefined;
	/**
	 * Another instance of the same site over a different schema (the data of the schema file), sharing this instance's connections. It is not
	 * installed: this instance keeps running the old schema. The settings screen uses it to check a change (diff, impact, a dry run of the transforms)
	 * before the file is written. Throws what `defineSite` throws when the schema is not valid, and when the config has no schema file.
	 */
	forSchema(schema: unknown): Cms<Config>;
	/**
	 * Development only: makes this instance run `schema` (the data of the schema file), in place (the same object, with a new site, store, services and read API).
	 * The settings screen calls it after it saved the file. A hand edit of the file needs no call: the dev server evaluates `monti.config.ts` again (hot module
	 * reload) and that makes a new instance. A schema that does not check leaves the instance as it was and says why. In production it does nothing: a production
	 * server runs the schema it was built with.
	 */
	reloadSchema(schema: unknown): SchemaReload;
	/**
	 * What this instance decided on its own and why: the database and schema (and which environment variable they came from), the login, whether the development
	 * bypass is on, whether the host is trusted, the site URL, the schema file and hot reload. `monti doctor` prints these.
	 */
	decisions(env?: Readonly<Record<string, string | undefined>>): readonly Decision[];
}
