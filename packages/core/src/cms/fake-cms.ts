import type { AuthContext, AuthGateway } from "../adapters/auth";
import { defineSite } from "../config/define";
import type { ContentStore } from "../core/store";
import { createFormatRegistry } from "../format/registry";
import type { CmsFormat } from "../format/types";
import type { MediaStore } from "../media/store";
import { createMemoryPluginStorage } from "../plugin/memory-storage";
import { createServerPlugins, type LoadedServerPlugin } from "../plugin/server";
import type { PluginStorage } from "../plugin/storage";
import { createRead } from "../read";
import { defineCollection } from "../schema/collection";
import { fields } from "../schema/fields";
import type { CmsAuth, CmsServerConfig } from "../server/define";
import { createEventDispatcher } from "../services/events";
import type { AnyCmsConfig } from "../site";
import { type BulkService, type Cms, type ContentService, createCms, lazyHandle } from "./create-cms";

/** What a test supplies to {@link fakeCms}. Whatever it leaves out fails loudly when the code under test touches it. */
export interface FakeCmsParts<Config extends AnyCmsConfig = AnyCmsConfig> {
	/**
	 * The site config the instance is created with. Default: a minimal one (an English site with one `page` collection), enough for code that only
	 * needs some site. Pass the config the code under test is written against.
	 */
	readonly config?: Config;
	/** The content store (`cms.store()`). Only the methods the code under test calls are needed. */
	readonly store?: Partial<ContentStore>;
	readonly contentService?: Partial<ContentService>;
	readonly bulkService?: Partial<BulkService>;
	readonly mediaStore?: Partial<MediaStore>;
	/** Plugin storage (`cms.storage(name)`). Default: in memory, one per instance, so plugins keep their data between calls of a test. */
	readonly storage?: (plugin: string) => PluginStorage;
	/** The admin check. Default: every request is an admin. Make it throw an `AuthError` to test a refused request. */
	readonly verifyAdmin?: AuthGateway["verifyAdmin"];
	/** Pieces of the login connection (`cms.auth()`): session, providers, handlers and so on. */
	readonly auth?: Partial<CmsAuth>;
	/** Other server config values (`hooks`, `publicApi`, `secret`, `trustHost`, ...). */
	readonly server?: Partial<CmsServerConfig>;
	/** The server side of the site's plugins (routes, features, hooks, migrations), as if the site config listed them. Default: none. */
	readonly plugins?: readonly LoadedServerPlugin[];
	/** Formats added to the built-in ones, as if a plugin provided them. Default: none. */
	readonly formats?: readonly CmsFormat[];
}

const DEFAULT_CONFIG = defineSite({
	collections: {
		page: defineCollection({
			label: "Page",
			kind: "document",
			path: "/:slug",
			fields: {
				title: fields.text({ label: "Title", required: true }),
				slug: fields.slug({ label: "Slug", from: "title", required: true }),
			},
		}),
	},
	locales: [{ code: "en", name: "English" }],
	defaultLocale: "en",
});

const ADMIN: AuthContext = { userId: "u", accountId: "g", isAdmin: true };

const missing = (what: string) => () => {
	throw new Error(`fakeCms: the test did not provide ${what}`);
};

/**
 * A CMS instance for tests that call route handlers, the read API or plugin code directly. It is a real instance (`createCms`) over a server config
 * whose database, media store and login are the parts the test provides, so the code under test goes through `cms` exactly as in the app.
 * Several fake instances can live in one test file, each with its own parts.
 */
export function fakeCms<const Config extends AnyCmsConfig = typeof DEFAULT_CONFIG>(
	parts: FakeCmsParts<Config> = {},
): Cms<Config> {
	const memory = createMemoryPluginStorage();
	const storageOf = parts.storage ?? memory.storage;
	const server: CmsServerConfig = {
		database: {
			name: "fake",
			createStore: () =>
				(parts.store ?? new Proxy({}, { get: (_t, name) => missing(`store.${String(name)}`) })) as ContentStore,
			migrate: async () => undefined,
			pluginStorage: (plugin) => storageOf(plugin),
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
	const cms = createCms<Config>({ config: parts.config ?? (DEFAULT_CONFIG as unknown as Config), server });
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
		() => fake as unknown as Cms,
	);
	const fake: Cms<Config> = {
		...cms,
		plugins: plugins.load,
		pluginRoutes: plugins.routes,
		pluginFeatures: plugins.features,
		writeHooks: plugins.writeHooks,
		// Delivers to the plugins of this fake (and the server config's hook), over the store the test provided.
		events: createEventDispatcher({
			...server.events,
			store: () =>
				server.database.createStore({ site: cms.site }) as ContentStore & { getEntry: ContentStore["getEntry"] },
			subscribers: plugins.eventSubscribers,
		}).events,
		formats: async () => createFormatRegistry(parts.formats ?? []),
		secrets: cms.secrets,
		authGateway,
		attachHost: () => undefined,
		handle: lazyHandle(() => fake as unknown as Cms),
		read: createRead<Config>({
			site: cms.site,
			store: cms.store,
			mediaStore: cms.mediaStore,
			formats: async () => createFormatRegistry(parts.formats ?? []),
			verifyAdmin: authGateway.verifyAdmin,
		}),
		...(parts.contentService ? { contentService: () => parts.contentService as ContentService } : {}),
		...(parts.bulkService ? { bulkService: () => parts.bulkService as BulkService } : {}),
	};
	return fake;
}
