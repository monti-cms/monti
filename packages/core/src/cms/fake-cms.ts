import type { AuthContext, AuthGateway } from "../adapters/auth";
import type { ContentStore } from "../adapters/postgres/content-store";
import type { MediaStore } from "../adapters/r2/types";
import type { PluginDatabase } from "../plugin/define";
import { createServerPlugins, type LoadedServerPlugin } from "../plugin/server";
import { createRead } from "../read";
import type { CmsAuth, CmsServerConfig } from "../server/define";
import { type BulkService, type Cms, type ContentService, createCms, lazyRouteHandler } from "./create-cms";

/** What a test supplies to {@link fakeCms}. Whatever it leaves out fails loudly when the code under test touches it. */
export interface FakeCmsParts {
	/** The content store (`cms.store()`). Only the methods the code under test calls are needed. */
	readonly store?: Partial<ContentStore>;
	readonly contentService?: Partial<ContentService>;
	readonly bulkService?: Partial<BulkService>;
	readonly mediaStore?: Partial<MediaStore>;
	/** Plugin database (`cms.database()`). */
	readonly database?: Partial<PluginDatabase>;
	/** The admin check. Default: every request is an admin. Make it throw an `AuthError` to test a refused request. */
	readonly verifyAdmin?: AuthGateway["verifyAdmin"];
	/** Pieces of the login connection (`cms.auth()`): session, providers, handlers and so on. */
	readonly auth?: Partial<CmsAuth>;
	/** Other server config values (`hooks`, `publicApi`, `secret`, `trustHost`, ...). */
	readonly server?: Partial<CmsServerConfig>;
	/** The server side of the site's plugins (routes, features, hooks, migrations), as if the site config listed them. Default: none. */
	readonly plugins?: readonly LoadedServerPlugin[];
}

const ADMIN: AuthContext = { userId: "u", accountId: "g", isAdmin: true };

const missing = (what: string) => () => {
	throw new Error(`fakeCms: the test did not provide ${what}`);
};

/**
 * A CMS instance for tests that call route handlers, the read API or plugin code directly. It is a real instance (`createCms`) over a server config
 * whose database, media store and login are the parts the test provides, so the code under test goes through `cms` exactly as in the app.
 * Several fake instances can live in one test file, each with its own parts.
 */
export function fakeCms(parts: FakeCmsParts = {}): Cms {
	const server: CmsServerConfig = {
		database: {
			name: "fake",
			createStore: () =>
				(parts.store ?? new Proxy({}, { get: (_t, name) => missing(`store.${String(name)}`) })) as ContentStore,
			migrate: async () => undefined,
			pluginDatabase: () => (parts.database ?? {}) as PluginDatabase,
		},
		auth: {
			name: "fake",
			create: () =>
				({
					basePath: "/api/cms/auth",
					handlers: { GET: missing("auth.handlers.GET"), POST: missing("auth.handlers.POST") },
					session: async () => null,
					providers: [],
					signIn: async () => undefined,
					signOut: async () => undefined,
					isAdmin: () => true,
					devBypass: false,
					devUserId: "local-dev",
					...parts.auth,
				}) as CmsAuth,
		},
		...(parts.mediaStore ? { media: { name: "fake", createStore: () => parts.mediaStore as MediaStore } } : {}),
		...parts.server,
	};
	const cms = createCms({ server });
	const authGateway: AuthGateway = {
		verifyAdmin: parts.verifyAdmin ?? (async () => ADMIN),
		isDevBypassActive: async () => false,
	};
	const plugins = createServerPlugins(
		(parts.plugins ?? []).map(({ name, ...serverSide }) => ({
			name,
			options: {},
			server: async () => ({ default: serverSide }),
		})),
		() => server,
		() => fake,
	);
	const fake: Cms = {
		...cms,
		plugins: plugins.load,
		pluginRoutes: plugins.routes,
		pluginFeatures: plugins.features,
		writeHooks: plugins.writeHooks,
		notifyAfterCommit: plugins.notifyAfterCommit,
		secrets: cms.secrets,
		authGateway,
		routeHandler: () => lazyRouteHandler(() => fake),
		read: createRead({ store: cms.store, mediaStore: cms.mediaStore, verifyAdmin: authGateway.verifyAdmin }),
		...(parts.contentService ? { contentService: () => parts.contentService as ContentService } : {}),
		...(parts.bulkService ? { bulkService: () => parts.bulkService as BulkService } : {}),
	};
	return fake;
}
