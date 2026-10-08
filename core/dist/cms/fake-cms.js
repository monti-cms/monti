import { defineSite } from "../config/define.js";
import { createFormatRegistry } from "../format/registry.js";
import { createMemoryPluginStorage } from "../plugin/memory-storage.js";
import { createServerPlugins } from "../plugin/server.js";
import { createRead } from "../read/index.js";
import { defineCollection } from "../schema/collection.js";
import { fields } from "../schema/fields.js";
import { createEventDispatcher } from "../services/events.js";
import { createCms, lazyHandle } from "./create-cms.js";
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
const ADMIN = { userId: "u", accountId: "g", isAdmin: true };
const missing = (what) => () => {
    throw new Error(`fakeCms: the test did not provide ${what}`);
};
/** A login connection for tests: no session, every request is an admin, and `parts` replaces whatever a test needs (`session`, `providers`, ...). */
export const fakeAuth = (parts) => ({
    name: "fake",
    create: () => ({
        basePath: "/api/cms/auth",
        handlers: { GET: missing("auth.handlers.GET"), POST: missing("auth.handlers.POST") },
        session: async () => null,
        providers: [],
        signIn: async () => undefined,
        signOut: async () => undefined,
        isAdmin: () => true,
        devBypass: false,
        devUserId: "local-dev",
        ...parts,
    }),
});
/**
 * A CMS instance for tests that call route handlers, the read API or plugin code directly. It is a real instance (`createCms`) over a server config
 * whose database, media store and login are the parts the test provides, so the code under test goes through `cms` exactly as in the app.
 * Several fake instances can live in one test file, each with its own parts.
 */
export function fakeCms(parts = {}) {
    const memory = createMemoryPluginStorage();
    const storageOf = parts.storage ?? memory.storage;
    const server = {
        database: {
            name: "fake",
            createStore: () => (parts.store ?? new Proxy({}, { get: (_t, name) => missing(`store.${String(name)}`) })),
            migrate: async () => undefined,
            pluginStorage: (plugin) => storageOf(plugin),
        },
        auth: fakeAuth(parts.auth),
        ...(parts.mediaStore ? { media: { name: "fake", createStore: () => parts.mediaStore } } : {}),
        ...parts.server,
    };
    const cms = createCms({ config: parts.config ?? DEFAULT_CONFIG, server });
    const authGateway = {
        verifyAdmin: parts.verifyAdmin ?? (async () => ADMIN),
        isDevBypassActive: async () => false,
    };
    const plugins = createServerPlugins((parts.plugins ?? []).map(({ name, ...serverSide }) => ({
        name,
        options: {},
        server: async () => ({ default: serverSide }),
    })), () => server, () => fake);
    const fake = {
        ...cms,
        plugins: plugins.load,
        pluginRoutes: plugins.routes,
        pluginFeatures: plugins.features,
        writeHooks: plugins.writeHooks,
        // Delivers to the plugins of this fake (and the server config's hook), over the store the test provided.
        events: createEventDispatcher({
            ...server.events,
            store: () => server.database.createStore({ site: cms.site }),
            subscribers: plugins.eventSubscribers,
        }).events,
        formats: async () => createFormatRegistry(parts.formats ?? []),
        secrets: cms.secrets,
        authGateway,
        attachHost: () => undefined,
        handle: lazyHandle(() => fake),
        read: createRead({
            site: cms.site,
            store: cms.store,
            mediaStore: cms.mediaStore,
            formats: async () => createFormatRegistry(parts.formats ?? []),
            verifyAdmin: authGateway.verifyAdmin,
        }),
        ...(parts.contentService
            ? { contentService: () => parts.contentService }
            : {}),
        ...(parts.bulkService ? { bulkService: () => parts.bulkService } : {}),
    };
    return fake;
}
