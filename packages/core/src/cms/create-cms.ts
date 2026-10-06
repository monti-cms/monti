import type { NextRequest } from "next/server";
import { type AuthGateway, CmsAuthGateway } from "../adapters/auth/auth-gateway";
import { resolveTrustHost } from "../adapters/auth/trust-host";
import type { ContentStore, Entry } from "../adapters/postgres/content-store";
import type { ContentChange } from "../adapters/postgres/store/after-commit";
import { CmsError } from "../adapters/postgres/store/errors";
import type { MediaStore } from "../adapters/r2/types";
import { cmsConfig } from "../config/resolved";
import { adminUrl } from "../core/admin-paths";
import type { CmsPlugin, OwnedPluginRoute, PluginDatabase } from "../plugin/define";
import { createServerPlugins, type LoadedServerPlugin } from "../plugin/server";
import { type CmsRead, createRead } from "../read";
import { createSecretsVault, type PluginSecrets, type PluginSecretsOptions } from "../secrets";
import type { CmsAuth, CmsServerConfig, DatabaseAdapter } from "../server/define";
import { createBulkService } from "../services/bulk-service";
import { createContentService } from "../services/content-service";
import type { HookSource } from "../services/hooks";

export type ContentService = ReturnType<typeof createContentService<Entry>>;
export type BulkService = ReturnType<typeof createBulkService<Entry>>;

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/**
 * Catch-all route handler. `params.path` holds the path segments after `/api/cms/` (e.g. `["v1", "entries", "<id>"]`).
 * Unknown paths return 404; a known path with an unsupported method returns 405.
 */
export type CmsRouteHandler = (
	request: NextRequest,
	context: { params: Promise<{ path: string[] }> },
) => Promise<Response>;

/** The server config as plugins see it: everything but the master secrets. */
export type PublicServerConfig = Omit<CmsServerConfig, "secret" | "previousSecrets">;

export interface CreateCmsOptions {
	/** The server config (`defineServerConfig(...)`): database, auth, media, secret, hooks, public API. */
	readonly server: CmsServerConfig;
	/**
	 * Name of this instance, only used to find it again when a development server reloads modules (see {@link createCms}). Default `"default"`.
	 * Give each instance its own id when one development process creates more than one.
	 */
	readonly id?: string;
}

/**
 * A CMS instance. It owns everything the server side needs, built from the server config: the store, services, media store, login connection,
 * plugin server modules, write hooks, and the route handler and read API on top of them. Nothing is global: two instances with different
 * server configs live side by side in one process.
 *
 * Connections are created on first use, so creating the instance (at import or build time) connects to nothing.
 */
export interface Cms {
	/** The server config this instance was created from, without the master secrets (`secret`, `previousSecrets`): plugins reach those only through `secrets()`. */
	readonly server: PublicServerConfig;
	/** The content store. Created on first use. */
	store(): ContentStore;
	/** Content write operations (drafts, publishing, duplicates, translations). Runs the write hooks. */
	contentService(): ContentService;
	/** Bulk write operations. Runs the write hooks. */
	bulkService(): BulkService;
	/** Whether the server config has a media store. Without one, the admin hides the media menu and uploads. */
	readonly isMediaConfigured: boolean;
	/** The media store. Throws `media_not_configured` if the server config has none. */
	mediaStore(): MediaStore;
	/** DB connection for plugins to read and create their own tables. */
	database(): PluginDatabase;
	/**
	 * The secrets API of one plugin: encryption of stored values and key derivation, with a key derived from the server config's `secret` and the plugin's
	 * name. The master secret itself is never handed out. A plugin asks for its own name (`cms.secrets("ai")`); another plugin's values do not decrypt
	 * with it. `options.legacy` lets the plugin keep reading values it stored in an older format.
	 */
	secrets(plugin: string, options?: PluginSecretsOptions): PluginSecrets;
	/** The login connection (`auth` in the server config): session, sign in and out, login methods, route handlers. */
	auth(): CmsAuth;
	/**
	 * The login connection's route handlers, for an app whose login path is not the default (`/api/cms/auth`) and so needs its own route file:
	 * `export const { GET, POST } = cms.authHandlers;`. The login connection is created on the first request.
	 */
	readonly authHandlers: CmsAuth["handlers"];
	/** Admin check for requests and screens. Uses `auth()`. */
	readonly authGateway: AuthGateway;
	/** Whether `Host` and `X-Forwarded-Host` can be trusted (`trustHost` in the server config, `AUTH_TRUST_HOST`, else off in production). */
	isHostTrusted(): boolean;
	/** The server side of the site config's plugins. Loaded on first use. */
	plugins(): Promise<readonly LoadedServerPlugin[]>;
	/** Plugin API route table (in plugin order). */
	pluginRoutes(): Promise<readonly OwnedPluginRoute[]>;
	/** Feature flags plugins add to the meta API, under each plugin's name. */
	pluginFeatures(): Promise<Record<string, Readonly<Record<string, boolean>>>>;
	/** Write hooks in the order they run: the server config's first, then the plugins'. */
	writeHooks(): Promise<readonly HookSource[]>;
	/** Calls the after-save notifications of the server config and the plugins. Never throws. */
	notifyAfterCommit(change: ContentChange): Promise<void>;
	/**
	 * Route handlers of the admin API (`/api/cms/v1/*`), the public API and the plugin routes, for the app's single catch-all route file
	 * (`app/api/cms/[...path]/route.ts`): `export const { GET, POST, PATCH, PUT, DELETE } = cms.routeHandler();`.
	 * The route code loads on the first request, so importing the route file loads little.
	 */
	routeHandler(): Record<Method, CmsRouteHandler>;
	/** Reads published content for the site's pages, and resolves public media. */
	readonly read: CmsRead;
	/**
	 * Creates the tables in the store, or brings them up to date (core tables, then plugin tables). Running it repeatedly gives the same result.
	 * Throws on failure. It leaves the connection open; call `close()` when a command-line tool is done.
	 */
	migrate(options?: { readonly log?: (message: string) => void }): Promise<void>;
	/**
	 * Re-serializes the stored bodies with the site's configured syntax (`monti content:rewrite`). Reports one line per body through `log` and writes only with `apply`.
	 * Throws on failure.
	 */
	rewrite(options?: { readonly apply?: boolean; readonly log?: (message: string) => void }): Promise<void>;
	/** Closes the database connection (when a command-line tool or a test is done). */
	close(): Promise<void>;
}

/**
 * Connections that must survive a development server reloading modules. Next's dev server evaluates `cms.server.ts` again after an edit, which calls
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

/** The route handlers of an instance, loading the route code on the first request. */
export function lazyRouteHandler(cms: () => Cms): Record<Method, CmsRouteHandler> {
	let handler: Promise<Record<Method, CmsRouteHandler>> | undefined;
	const load = () => {
		handler ??= import("../http/router").then((module) => module.createRouteHandler(cms()));
		return handler;
	};
	const method =
		(name: Method): CmsRouteHandler =>
		async (request, context) =>
			(await load())[name](request, context);
	return {
		GET: method("GET"),
		POST: method("POST"),
		PATCH: method("PATCH"),
		PUT: method("PUT"),
		DELETE: method("DELETE"),
	};
}

/** Plugins of the site config. A config without plugins has an empty tuple type, so it is widened for reading. */
const sitePlugins = (): readonly CmsPlugin[] => cmsConfig.plugins ?? [];

/**
 * Creates the CMS instance. Export it from a module of your app (conventionally `cms.server.ts`) and import it where you need it:
 *
 * ```ts
 * export const cms = createCms({ server: defineServerConfig({ database: postgres({ ... }), auth: githubAuth({ ... }) }) });
 * ```
 *
 * The site config (`cms.config.ts`) is still linked through the `@cms-config` alias.
 */
export function createCms(options: CreateCmsOptions): Cms {
	const { server, id = "default" } = options;
	const { secret, previousSecrets, ...publicServer } = server;
	const vault = createSecretsVault({ secret, previousSecrets });
	const connections = connectionsFor(id, server);
	const plugins = createServerPlugins(
		sitePlugins(),
		() => server,
		() => cms,
	);

	let store: ContentStore | undefined;
	let service: ContentService | undefined;
	let bulk: BulkService | undefined;
	let auth: CmsAuth | undefined;

	const isHostTrusted = () => resolveTrustHost(server.trustHost);
	const getAuth = (): CmsAuth => {
		auth ??= server.auth.create({ loginPath: adminUrl("/login"), trustHost: isHostTrusted() });
		return auth;
	};
	const getStore = (): ContentStore => {
		store ??= connections.database.createStore({ afterCommit: plugins.notifyAfterCommit });
		return store;
	};
	const getMediaStore = (): MediaStore => {
		if (!server.media) throw new CmsError("Media storage is not configured", "media_not_configured");
		connections.mediaStore ??= server.media.createStore();
		return connections.mediaStore;
	};
	const authGateway = new CmsAuthGateway(getAuth);

	const cms: Cms = {
		server: publicServer,
		store: getStore,
		contentService: () => {
			service ??= createContentService<Entry>(getStore(), { hooks: plugins.writeHooks });
			return service;
		},
		bulkService: () => {
			bulk ??= createBulkService<Entry>(getStore(), { hooks: plugins.writeHooks });
			return bulk;
		},
		isMediaConfigured: Boolean(server.media),
		mediaStore: getMediaStore,
		database: () => connections.database.pluginDatabase(),
		secrets: (plugin, secretsOptions) => vault.forPlugin(plugin, secretsOptions),
		auth: getAuth,
		authHandlers: {
			GET: (request) => getAuth().handlers.GET(request),
			POST: (request) => getAuth().handlers.POST(request),
		},
		authGateway,
		isHostTrusted,
		plugins: plugins.load,
		pluginRoutes: plugins.routes,
		pluginFeatures: plugins.features,
		writeHooks: plugins.writeHooks,
		notifyAfterCommit: plugins.notifyAfterCommit,
		routeHandler: () => lazyRouteHandler(() => cms),
		read: createRead({ store: getStore, mediaStore: getMediaStore, verifyAdmin: () => authGateway.verifyAdmin() }),
		migrate: async ({ log = console.log } = {}) => {
			log(`Starting CMS database migration (${connections.database.name})...`);
			await connections.database.migrate();
			await plugins.migrate(connections.database.pluginDatabase(), log);
			log("CMS database migration completed successfully!");
		},
		rewrite: async ({ apply, log = console.log } = {}) => {
			const { rewriteContent, formatRewriteReport } = await import("../adapters/postgres/store/rewrite");
			const { pool, schema } = connections.database.pluginDatabase();
			for (const line of formatRewriteReport(await rewriteContent(pool, { apply, schema }))) log(line);
		},
		close: async () => {
			await connections.database.close?.();
		},
	};
	return cms;
}
