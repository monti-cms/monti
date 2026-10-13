import { existsSync } from "node:fs";
import path from "node:path";
import { type AuthGateway, CmsAuthGateway } from "../adapters/auth/auth-gateway";
import { explainTrustHost, resolveTrustHost } from "../adapters/auth/trust-host";
import { type ApiKeys, type ApiKeysOptions, createApiKeys } from "../api-keys/api-keys";
import { problemText } from "../core/problem";
import type { ImageWarningResolvers } from "../core/snapshot";
import { CmsError, type ContentStore, type Entry, withEventDispatch } from "../core/store";
import type { SaveDraftInput, ServiceInput } from "../core/types";
import type { FormatRegistry } from "../format/registry";
import type { MediaStore } from "../media/store";
import { API_KEYS_SCOPE, AUTH_SCOPE, EVENTS_SCOPE } from "../plugin/collisions";
import type { OwnedPluginRoute } from "../plugin/define";
import { createServerPlugins, type LoadedServerPlugin } from "../plugin/server";
import type { PluginStorage } from "../plugin/storage";
import { type CmsRead, createRead } from "../read";
import { findSchemaFile } from "../schema-file/locate";
import { schemaSourceOf } from "../schema-file/source";
import { createSecretsVault, type PluginSecrets } from "../secrets";
import type { Decision } from "../server/decision";
import type {
	CmsAuth,
	CmsServerConfig,
	DatabaseAdapter,
	DatabaseState,
	RequestHost,
	TransactionStorage,
} from "../server/define";
import { createBulkService } from "../services/bulk-service";
import { createContentService } from "../services/content-service";
import { type CmsEvents, createEventDispatcher } from "../services/events";
import type { HookSource } from "../services/hooks";
import { createMediaService, type MediaService } from "../services/media-service";
import { mediaUrlResolver } from "../services/media-urls";
import { createPreferencesService, type PreferencesService } from "../services/preferences-service";
import { type AnyCmsConfig, createSite, type Site } from "../site";
import { coreDecisions } from "./decisions";

/** The content service of any site: input is checked at run time only. */
type LooseContentService = ReturnType<typeof createContentService>;

type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * The content service. With the config of the instance (`Cms<typeof config>` has `ContentService<typeof config>`), `createDraft` and `saveDraft` know the
 * collections and the metadata of each, and an item collection (a tag) needs no body. Without a config it takes any collection.
 */
export type ContentService<Config extends AnyCmsConfig = AnyCmsConfig> = Omit<
	LooseContentService,
	"createDraft" | "saveDraft"
> & {
	createDraft(
		input: ServiceInput<IsAny<Config> extends true ? AnyCmsConfig : Config>,
		options?: { publishImmediately?: boolean },
	): ReturnType<LooseContentService["createDraft"]>;
	saveDraft(
		entryId: string,
		input: SaveDraftInput<IsAny<Config> extends true ? AnyCmsConfig : Config>,
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
	Config extends AnyCmsConfig = any,
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

/**
 * Connections that must survive a development server reloading modules. Next's dev server evaluates `monti.config.ts` again after an edit, which calls
 * `createCms` again. A new database adapter would open a second connection pool and leave the first one open, so in development the first adapter
 * (and the media store, which keeps its own client) of an instance is reused by the instances created later with the same `id`.
 * Everything else (store, services, login connection, plugins, hooks) is rebuilt by the new instance from its own server config, so edits to
 * hooks and other options take effect. Changing the database connection itself needs a restart.
 *
 * This is the only cache outside an instance. It is development only (`NODE_ENV=development`): in production and in tests an instance owns its
 * connections alone, and the cache is not used.
 */
interface SharedConnections {
	database: DatabaseAdapter;
	mediaStore?: MediaStore;
}

const DEV_CONNECTIONS = Symbol.for("monti.cms.dev-connections");

function connectionsFor(id: string, server: CmsServerConfig): SharedConnections {
	if (process.env.NODE_ENV !== "development") return { database: server.database };
	const global = globalThis as unknown as { [DEV_CONNECTIONS]?: Map<string, SharedConnections> };
	const registry = global[DEV_CONNECTIONS] ?? new Map<string, SharedConnections>();
	global[DEV_CONNECTIONS] = registry;
	let connections = registry.get(id);
	if (!connections) {
		connections = { database: server.database };
		registry.set(id, connections);
	}
	return connections;
}

/** The request handler of an instance, loading the route code on the first request. */
export function lazyHandle(cms: () => Cms): Cms["handle"] {
	let handler: Promise<ReturnType<typeof import("../http/router").createRequestHandler>> | undefined;
	return async (request, options) => {
		handler ??= import("../http/router").then((module) => module.createRequestHandler(cms()));
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
export function createCms<const Config extends AnyCmsConfig>(options: CreateCmsOptions<Config>): Cms<Config> {
	const { server, id = "default" } = options;
	const { secret, previousSecrets, events: eventOptions, ...publicServer } = server;
	const vault = createSecretsVault({ secret, previousSecrets });
	const connections = connectionsFor(id, server);
	const isHostTrusted = () => resolveTrustHost(server.trustHost);
	let attachedHost: RequestHost | undefined;
	/** Looks the attached host up when asked, so a login created before an integration attached itself still sees it. */
	const host: RequestHost = {
		requestHeaders: async () => (await attachedHost?.requestHeaders?.()) ?? null,
		rethrow: (error) => attachedHost?.rethrow?.(error),
	};

	/** Everything of an instance that depends on its site (its config): rebuilt when the schema changes. `self` is the instance the parts belong to. */
	const build = (config: Config, self: () => Cms<Config>): Omit<Cms<Config>, SchemaMembers> => {
		const site = createSite(config);
		const plugins = createServerPlugins(
			site.plugins,
			() => server,
			// The plugins and the handler take the instance as the loose `Cms`, whatever the type of its config.
			() => self() as unknown as Cms,
		);

		const keyLabels: ApiKeysOptions["labels"] = async (plugin, refs) => {
			const owner = (await plugins.load()).find((candidate) => candidate.name === plugin);
			if (!owner?.keyUses) return Object.fromEntries(refs.map((ref) => [ref, plugin]));
			return owner.keyUses(self() as unknown as Cms, refs);
		};
		const declaredSlots = () =>
			site.plugins.flatMap((plugin) =>
				(plugin.keySlots ?? []).map((slot) => ({
					plugin: plugin.name,
					slot: slot.id,
					service: slot.service,
					label: typeof slot.label === "function" ? slot.label(site) : slot.label,
				})),
			);
		const inTransaction = <T>(work: (tx: TransactionStorage) => Promise<T>): Promise<T> =>
			connections.database.transaction(work);
		const keysOn = (storage: () => PluginStorage, transact?: ApiKeysOptions["transact"]): ApiKeys =>
			createApiKeys({
				storage,
				secrets: vault.forPlugin(API_KEYS_SCOPE),
				labels: keyLabels,
				declared: declaredSlots,
				...(transact ? { transact } : {}),
			});
		const apiKeys: ApiKeys = keysOn(
			() => connections.database.pluginStorage(API_KEYS_SCOPE),
			(work) => inTransaction((tx) => work(() => tx.pluginStorage(API_KEYS_SCOPE))),
		);
		let store: ContentStore | undefined;
		let service: LooseContentService | undefined;
		let bulk: BulkService | undefined;
		let media: MediaService | undefined;
		let preferences: PreferencesService | undefined;
		let auth: CmsAuth | undefined;

		const getAuth = (): CmsAuth => {
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
		let rawStore: ContentStore | undefined;
		const getRawStore = (): ContentStore => {
			rawStore ??= connections.database.createStore({ site });
			return rawStore;
		};
		const dispatcher = createEventDispatcher({
			...eventOptions,
			store: getRawStore,
			subscribers: plugins.eventSubscribers,
			// The marks of `event.once` live in the plugin storage, under a name no plugin can take (`CORE_FEATURE_KEYS`).
			marks: () => connections.database.pluginStorage(EVENTS_SCOPE).collection<{ at: string }>("once"),
		});
		// Every write goes through the dispatcher: the store writes the events in the transaction of the change, the wrapper delivers them after the commit.
		const getStore = (): ContentStore => {
			store ??= withEventDispatch(getRawStore(), dispatcher.dispatchEntry);
			return store;
		};
		const getMediaStore = (): MediaStore => {
			if (!server.media) {
				throw new CmsError(
					problemText({
						what: "Media storage is not configured, so there is nowhere to keep uploads",
						where: "`storage` in monti.config.ts",
						fix: "add a storage adapter, for example `storage: s3Storage()` (@monti-cms/storage-s3, which reads the S3_* values)",
					}),
					"media_not_configured",
				);
			}
			connections.mediaStore ??= server.media.createStore();
			return connections.mediaStore;
		};
		const authGateway = new CmsAuthGateway(getAuth);

		/** Runs the steps of the core tables and the plugins. The callers print the first and last line. */
		const runMigration = async (
			{ log = console.log }: MigrateRunOptions,
			/** Where the line per plugin goes. First-time setup leaves it out: the plugin tables are in the count of created tables. */
			pluginLog: (message: string) => void = log,
		) => {
			const summary = await connections.database.migrate({ site, formats: await plugins.formats() });
			await plugins.migrate((plugin) => connections.database.pluginStorage(plugin), pluginLog);
			return { summary };
		};

		/** What a publish looks up for its image warnings. The stored file is checked once more when a media store is configured. */
		const imageChecks = (): ImageWarningResolvers => ({
			getMediaAsset: (mediaId) => getStore().getMediaAsset(mediaId),
			...(server.media
				? {
						headStorageKey: async (storageKey: string) => {
							try {
								return (await getMediaStore().headFile({ key: storageKey })) !== null;
							} catch {
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
				return service as unknown as ContentService<Config>;
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
			secrets: (plugin) => vault.forPlugin(plugin),
			apiKeys,
			transaction: (work) =>
				inTransaction((tx) =>
					work({
						storage: (plugin) => tx.pluginStorage(plugin),
						apiKeys: keysOn(() => tx.pluginStorage(API_KEYS_SCOPE)),
					}),
				),
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
			handle: lazyHandle(() => self() as unknown as Cms),
			read: createRead({
				site,
				store: getStore,
				mediaStore: getMediaStore,
				formats: plugins.formats,
				verifyAdmin: () => authGateway.verifyAdmin(),
			}),
			migrate: async (options = {}) => {
				const log = options.log ?? console.log;
				const target = connections.database.inspector?.describeTarget();
				log("Bringing Monti's tables up to date with this version\u2026");
				log(`Database: ${target ?? connections.database.name}`);
				const { summary } = await runMigration(options);
				const applied = summary?.applied ?? 0;
				log(
					summary
						? applied === 0
							? "Already up to date."
							: `Applied ${applied} step${applied === 1 ? "" : "s"}, ${summary.upToDate} already up to date.`
						: "Done.",
				);
			},
			databaseState: async () => connections.database.inspector?.state(),
			setup: async ({ log = console.log } = {}) => {
				const target = connections.database.inspector?.describeTarget();
				const before = await connections.database.inspector?.state();
				if (before?.set) {
					log(
						`Monti is already set up in this database (schema "${before.schema}"). After updating Monti, run \`monti db:migrate\`.`,
					);
					return { created: false, tables: 0 };
				}
				log(`Creating Monti's tables in ${target ?? `the ${connections.database.name} database`}\u2026`);
				if (before && before.tables > 0) {
					log(
						`The schema "${before.schema}" already has ${before.tables} other table${before.tables === 1 ? "" : "s"}; Monti only adds its own and does not touch them.`,
					);
				}
				await runMigration({ log }, () => undefined);
				const after = await connections.database.inspector?.state();
				const tables = after ? after.tables - (before?.tables ?? 0) : 0;
				log(after ? `Done: created ${tables} table${tables === 1 ? "" : "s"}.` : "Done.");
				return { created: true, tables };
			},
			close: async () => {
				await connections.database.close?.();
			},
		};
	};

	const source = schemaSourceOf(options.config);
	/** The schema file of the config, found on first use (creating the instance does no file access). */
	let schemaPath: string | null | undefined;
	const schemaFile = (): string | undefined => {
		if (schemaPath === undefined) {
			schemaPath = null;
			if (source) {
				try {
					schemaPath = path.resolve(process.cwd(), options.schemaFile ?? findSchemaFile(process.cwd()));
					if (!existsSync(schemaPath)) schemaPath = null;
				} catch {
					schemaPath = null;
				}
			}
		}
		return schemaPath ?? undefined;
	};

	const forSchema = (schema: unknown): Cms<Config> => {
		if (!source)
			throw new Error("cms: this instance's config has no schema file (it is not made with `defineSite({ schema })`)");
		const next = source.rebuild(schema) as Config;
		const detached: Cms<Config> = {
			...build(next, () => detached),
			schemaFile,
			forSchema: (other) => cms.forSchema(other),
			reloadSchema: () => ({ reloaded: false, reason: "detached" }),
			decisions: (env) => cms.decisions(env),
		};
		return detached;
	};

	// The part of the instance that changes when the schema is reloaded.
	let current = build(options.config, () => cms);
	let reported: string | undefined;
	const reloadSchema = (schema: unknown): SchemaReload => {
		if (process.env.NODE_ENV !== "development") return { reloaded: false, reason: "production" };
		if (!source) return { reloaded: false, reason: "no_schema_file" };
		try {
			const next = build(source.rebuild(schema) as Config, () => cms);
			const { site: _site, ...parts } = next;
			current = next;
			Object.assign(cms, parts);
			reported = undefined;
			return { reloaded: true };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			// A schema that is invalid is reported once; the instance keeps running the last good one.
			if (message !== reported) console.error(`monti: the schema was not reloaded: ${message}`);
			reported = message;
			return { reloaded: false, reason: message };
		}
	};

	const decisions = (env: Readonly<Record<string, string | undefined>> = process.env): readonly Decision[] => {
		const file = schemaFile();
		return [
			...(server.database.inspector?.decisions(env) ?? []),
			...(server.auth.decisions?.(env) ?? []),
			...coreDecisions({
				env,
				trust: explainTrustHost(server.trustHost, env),
				siteUrl: current.site.config.site?.url,
				siteUrlSource: options.siteUrlSource,
				schemaFile: file ? path.relative(process.cwd(), file) || file : undefined,
				schemaFileGiven: Boolean(options.schemaFile),
				hotReload: env.NODE_ENV === "development" && Boolean(source && file),
			}),
		];
	};

	const { site: _first, ...rest } = current;
	const cms: Cms<Config> = Object.defineProperties(
		{ ...rest, schemaFile, forSchema, reloadSchema, decisions } as Cms<Config>,
		{
			site: { enumerable: true, get: () => current.site },
		},
	);
	return cms;
}

/** The members of an instance that are not rebuilt with the site. */
type SchemaMembers = "schemaFile" | "forSchema" | "reloadSchema" | "decisions";
