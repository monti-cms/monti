import { CmsAuthGateway } from "../adapters/auth/auth-gateway";
import { resolveTrustHost } from "../adapters/auth/trust-host";
import { type ApiKeys, type ApiKeysOptions, createApiKeys } from "../api-keys/api-keys";
import type { CmsConfig } from "../config/define";
import { problemText } from "../core/problem";
import type { ImageWarningResolvers } from "../core/snapshot";
import { CmsError, type ContentStore, withEventDispatch } from "../core/store";
import type { MediaStore } from "../media/store";
import { API_KEYS_SCOPE, AUTH_SCOPE } from "../plugin/collisions";
import { createServerPlugins } from "../plugin/server";
import type { PluginStorage } from "../plugin/storage";
import { createRead } from "../read";
import { createSecretsVault } from "../secrets";
import type { CmsAuth, RequestHost, TransactionStorage } from "../server/define";
import { createBulkService } from "../services/bulk-service";
import { createContentService } from "../services/content-service";
import { createEventDispatcher } from "../services/events";
import { createMediaService, type MediaService } from "../services/media-service";
import { mediaUrlResolver } from "../services/media-urls";
import { createPreferencesService, type PreferencesService } from "../services/preferences-service";
import { createSite } from "../site";

export type * from "./types";

import { connectionsFor } from "./connections";
import { createMigrator } from "./migrate-run";
import type { SchemaMembers } from "./reload";
import { withSchemaControls } from "./reload";
import type { BulkService, Cms, CmsHost, ContentService, CreateCmsOptions, LooseContentService } from "./types";

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
export function createCms<const Config extends CmsConfig>(options: CreateCmsOptions<Config>): CmsHost<Config> {
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
	const build = (config: Config, self: () => CmsHost<Config>): Omit<CmsHost<Config>, SchemaMembers> => {
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
			return owner.keyUses(refs, plugins.scopeOf(plugin));
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
		const slotChanged = (plugin: string, slot: string) => plugins.keySlotChanged(plugin, slot);
		const inTransaction = <T>(work: (tx: TransactionStorage) => Promise<T>): Promise<T> =>
			connections.database.transaction(work);
		const keysOn = (
			storage: () => PluginStorage,
			transact?: ApiKeysOptions["transact"],
			/** `keySlot.changed` is told of changes made outside a transaction only: inside one, the change is not saved yet. */
			notify = true,
		): ApiKeys =>
			createApiKeys({
				storage,
				secrets: vault.forPlugin(API_KEYS_SCOPE),
				labels: keyLabels,
				declared: declaredSlots,
				...(notify ? { onSlotChange: slotChanged } : {}),
				...(transact ? { transact } : {}),
			});
		const apiKeys: ApiKeys = keysOn(
			() => connections.database.pluginStorage(API_KEYS_SCOPE),
			(work) => inTransaction((tx) => work(() => tx.pluginStorage(API_KEYS_SCOPE))),
		);
		/** What `cms.plugin(name).once` made. It belongs to this build, so a schema reload (a new build) starts it empty. */
		const pluginValues = new Map<string, unknown>();
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
			plugin: (name) => ({
				name,
				// Read when asked, so a plugin that needs only one of them does not open a connection for the others.
				get storage() {
					return connections.database.pluginStorage(name);
				},
				get secrets() {
					return vault.forPlugin(name);
				},
				key: (id) => apiKeys.slot(name, id),
				apiKeys,
				once: (key, factory) => {
					const id = `${name}/${key}`;
					if (!pluginValues.has(id)) pluginValues.set(id, factory());
					return pluginValues.get(id) as ReturnType<typeof factory>;
				},
			}),
			apiKeys,
			transaction: (work) =>
				inTransaction((tx) =>
					work({
						storage: (plugin) => tx.pluginStorage(plugin),
						apiKeys: keysOn(() => tx.pluginStorage(API_KEYS_SCOPE), undefined, false),
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
			...createMigrator({ connections, site, plugins }),
			close: async () => {
				await connections.database.close?.();
			},
		};
	};

	return withSchemaControls<Config>({ options, server, build });
}
