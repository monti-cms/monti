import { afterEach, describe, expect, it, vi } from "vitest";
import { contentCollection, defaultLocale } from "../../../test/any-site";
import { testConfig } from "../../../test/site";
import type { ClaimedDelivery, ContentChange, ContentStore } from "../../core/store";
import type { CmsAuth, CmsServerConfig, DatabaseAdapter } from "../../server/define";
import { createCms } from "../create-cms";

/** A database adapter that records how it was used. `tag` marks everything that came from this adapter. */
function fakeDatabase(tag: string) {
	const adapter = {
		name: `fake-${tag}`,
		createStore: vi.fn(() => {
			const store = {
				tag,
				// A one-slot outbox: what a test puts in `claims` is what the next claim returns.
				claims: [] as ClaimedDelivery[],
				enqueueEvents: vi.fn(async () => 0),
				claimDeliveries: vi.fn(async () => store.claims.splice(0)),
				completeDelivery: vi.fn(async () => undefined),
				failDelivery: vi.fn(async () => "failed" as const),
				pruneEvents: vi.fn(async () => 0),
				getPreferences: async () => ({ editor: { inspectorOpen: tag === "a" } }),
				listPublishedTranslations: async () => [
					{ collection: contentCollection, slug: `slug-${tag}`, locale: defaultLocale },
				],
			};
			return store as unknown as ContentStore & typeof store;
		}),
		migrate: vi.fn(async () => undefined),
		pluginStorage: vi.fn((plugin: string) => ({ plugin: `${tag}:${plugin}` }) as never),
		close: vi.fn(async () => undefined),
	};
	return adapter satisfies DatabaseAdapter;
}

const fakeAuth = (tag: string, devUserId = tag): CmsAuth => ({
	basePath: "/api/cms/auth",
	handlers: {
		GET: async () => new Response(`auth-${tag}`),
		POST: async () => new Response(`auth-${tag}`),
	},
	session: async () => ({ user: { id: devUserId, accountId: devUserId } }),
	providers: [],
	signIn: async () => undefined,
	signOut: async () => undefined,
	isAdmin: (userId) => userId === devUserId,
	devBypass: false,
	devUserId,
});

/** A server config whose pieces all carry `tag`, so a test can tell which instance a value came from. */
function serverFor(tag: string, extra: Partial<CmsServerConfig> = {}) {
	const database = fakeDatabase(tag);
	const afterCommit = vi.fn();
	const server: CmsServerConfig = {
		database,
		auth: { name: tag, create: () => fakeAuth(tag) },
		secret: `secret-${tag}`,
		hooks: { afterCommit },
		...extra,
	};
	return { server, database, afterCommit };
}

const DEV_REGISTRY = Symbol.for("monti.cms.dev-connections");
afterEach(() => {
	vi.unstubAllEnvs();
	delete (globalThis as Record<symbol, unknown>)[DEV_REGISTRY];
});

describe("createCms: an instance owns its server resources", () => {
	it("connects to nothing until a resource is used", () => {
		const { server, database } = serverFor("a");
		const cms = createCms({ config: testConfig, server });
		expect(database.createStore).not.toHaveBeenCalled();
		expect(database.pluginStorage).not.toHaveBeenCalled();
		cms.store();
		expect(database.createStore).toHaveBeenCalledTimes(1);
	});

	it("creates each resource once per instance and reuses it", () => {
		const cms = createCms({ config: testConfig, server: serverFor("a").server });
		expect(cms.store()).toBe(cms.store());
		expect(cms.contentService()).toBe(cms.contentService());
		expect(cms.bulkService()).toBe(cms.bulkService());
		expect(cms.auth()).toBe(cms.auth());
	});

	it("two instances with different server configs live side by side in one process", async () => {
		const a = serverFor("a", { trustHost: true });
		const b = serverFor("b", {
			trustHost: false,
			media: { name: "media-b", createStore: () => ({ tag: "b" }) as never },
		});
		const cmsA = createCms({ config: testConfig, server: a.server });
		const cmsB = createCms({ config: testConfig, server: b.server });

		// Each reads its own database, secret, trust setting and media storage.
		expect((cmsA.store() as unknown as { tag: string }).tag).toBe("a");
		expect((cmsB.store() as unknown as { tag: string }).tag).toBe("b");
		expect(cmsA.storage("ai").plugin).toBe("a:ai");
		expect(cmsB.storage("ai").plugin).toBe("b:ai");
		expect(cmsA.secrets("ai").decrypt(cmsA.secrets("ai").encrypt("x"))).toBe("x");
		expect(cmsB.secrets("ai").decrypt(cmsA.secrets("ai").encrypt("x"))).toBeNull();
		expect([cmsA.isHostTrusted(), cmsB.isHostTrusted()]).toEqual([true, false]);
		expect([cmsA.isMediaConfigured, cmsB.isMediaConfigured]).toEqual([false, true]);
		expect(() => cmsA.mediaStore()).toThrow(/not configured/);
		expect((cmsB.mediaStore() as unknown as { tag: string }).tag).toBe("b");
		expect(a.database.createStore).toHaveBeenCalledTimes(1);
		expect(b.database.createStore).toHaveBeenCalledTimes(1);

		// Each serves its own requests: `handle`, the login connection and the read API all go through the instance.
		const preferences = async (cms: typeof cmsA) => {
			const response = await cms.handle(new Request("http://localhost/api/cms/v1/preferences"));
			return { status: response.status, editor: (await response.json()).editor };
		};
		expect(await preferences(cmsA)).toEqual({ status: 200, editor: { inspectorOpen: true } });
		expect(await preferences(cmsB)).toEqual({ status: 200, editor: { inspectorOpen: false } });
		const authSession = (cms: typeof cmsA) => cms.handle(new Request("http://localhost/api/cms/auth/session"));
		expect(await (await authSession(cmsA)).text()).toBe("auth-a");
		expect(await (await authSession(cmsB)).text()).toBe("auth-b");
		// A login route file of the app (for a login path that is not the default) uses the instance's own handlers, created on the first request.
		expect(await (await cmsA.authHandlers.GET(new Request("http://localhost/api/auth/session"))).text()).toBe("auth-a");
		expect(await (await cmsB.authHandlers.POST(new Request("http://localhost/api/auth/signin"))).text()).toBe("auth-b");
		expect((await cmsA.read.getTranslations({ translationGroupId: "g" }))[0]?.slug).toBe("slug-a");
		expect((await cmsB.read.getTranslations({ translationGroupId: "g" }))[0]?.slug).toBe("slug-b");
	});

	it("runs only its own server config's hooks, also for the store's after-commit notifications", async () => {
		const a = serverFor("a");
		const b = serverFor("b");
		const cmsA = createCms({ config: testConfig, server: a.server });
		const cmsB = createCms({ config: testConfig, server: b.server });
		expect((await cmsA.writeHooks()).map((source) => source.owner)).toEqual(["server"]);

		const claim = (subscriber: string): ClaimedDelivery => ({
			change: { eventId: "ev1", kind: "saved", entryId: "e1" } as ContentChange,
			subscriber,
			attempts: 1,
		});
		const storeA = cmsA.store() as unknown as ReturnType<typeof a.database.createStore>;
		const storeB = cmsB.store() as unknown as ReturnType<typeof b.database.createStore>;
		storeA.claims.push(claim("server"));
		await cmsA.events.retry();
		expect(a.afterCommit).toHaveBeenCalledTimes(1);
		expect(a.afterCommit).toHaveBeenCalledWith(expect.objectContaining({ eventId: "ev1", kind: "saved", attempt: 1 }));
		expect(b.afterCommit).not.toHaveBeenCalled();
		// Each instance claims for its own subscribers, on its own store.
		expect(storeA.claimDeliveries).toHaveBeenCalledWith(expect.objectContaining({ subscribers: ["server"] }));
		expect(storeB.claimDeliveries).not.toHaveBeenCalled();
		storeB.claims.push(claim("server"));
		await cmsB.events.retry();
		expect(b.afterCommit).toHaveBeenCalledTimes(1);
		expect(a.afterCommit).toHaveBeenCalledTimes(1);
	});

	it("`migrate` and `close` act on its own database only", async () => {
		const a = serverFor("a");
		const b = serverFor("b");
		const logs: string[] = [];
		const cmsA = createCms({ config: testConfig, server: a.server });
		createCms({ config: testConfig, server: b.server });
		await cmsA.migrate({ log: (message) => logs.push(message) });
		await cmsA.close();
		expect(a.database.migrate).toHaveBeenCalledTimes(1);
		expect(a.database.close).toHaveBeenCalledTimes(1);
		expect(b.database.migrate).not.toHaveBeenCalled();
		expect(b.database.close).not.toHaveBeenCalled();
		expect(logs[0]).toContain("fake-a");
		expect(logs.at(-1)).toContain("completed");
	});

	it("keeps no global state: nothing is left on the global object", async () => {
		const cms = createCms({ config: testConfig, server: serverFor("a").server });
		cms.store();
		cms.contentService();
		cms.auth();
		await cms.read.getTranslations({ translationGroupId: "g" });
		expect(Object.keys(globalThis).filter((key) => key.startsWith("__cms"))).toEqual([]);
		expect(Object.getOwnPropertySymbols(globalThis).filter((key) => key === DEV_REGISTRY)).toEqual([]);
	});
});

describe("createCms: a development reload does not leak connections", () => {
	it("reuses the first database adapter of an instance when its module is evaluated again", () => {
		vi.stubEnv("NODE_ENV", "development");
		const first = serverFor("first");
		const reloaded = serverFor("reloaded");
		createCms({ config: testConfig, server: first.server }).store();
		const after = createCms({ config: testConfig, server: reloaded.server });
		const store = after.store() as unknown as { tag: string };
		// The new instance builds its store from the adapter that already owns the pool, and never opens a second one.
		expect(store.tag).toBe("first");
		expect(first.database.createStore).toHaveBeenCalledTimes(2);
		expect(reloaded.database.createStore).not.toHaveBeenCalled();
		expect(after.storage("ai").plugin).toBe("first:ai");
	});

	it("rebuilds everything else from the new server config, so edits to hooks and options take effect", async () => {
		vi.stubEnv("NODE_ENV", "development");
		const first = serverFor("first");
		const reloaded = serverFor("reloaded");
		createCms({ config: testConfig, server: first.server });
		const after = createCms({ config: testConfig, server: reloaded.server });
		const sealed = createCms({ config: testConfig, server: reloaded.server }).secrets("ai").encrypt("x");
		expect(after.secrets("ai").decrypt(sealed)).toBe("x");
		(after.store() as unknown as { claims: ClaimedDelivery[] }).claims.push({
			change: { eventId: "ev", kind: "saved", entryId: "e" } as ContentChange,
			subscriber: "server",
			attempts: 1,
		});
		await after.events.retry();
		expect(reloaded.afterCommit).toHaveBeenCalledTimes(1);
		expect(first.afterCommit).not.toHaveBeenCalled();
	});

	it("keeps the media store across reloads too", () => {
		vi.stubEnv("NODE_ENV", "development");
		const create = vi.fn(() => ({}) as never);
		const media = { name: "media", createStore: create };
		const first = createCms({ config: testConfig, server: serverFor("a", { media }).server });
		const second = createCms({ config: testConfig, server: serverFor("a", { media }).server });
		expect(second.mediaStore()).toBe(first.mediaStore());
		expect(create).toHaveBeenCalledTimes(1);
	});

	it("instances with different ids do not share connections", () => {
		vi.stubEnv("NODE_ENV", "development");
		const one = serverFor("one");
		const two = serverFor("two");
		const cmsOne = createCms({ config: testConfig, id: "one", server: one.server });
		const cmsTwo = createCms({ config: testConfig, id: "two", server: two.server });
		expect((cmsOne.store() as unknown as { tag: string }).tag).toBe("one");
		expect((cmsTwo.store() as unknown as { tag: string }).tag).toBe("two");
	});

	it("outside development an instance owns its connections alone: a second instance never adopts them", () => {
		vi.stubEnv("NODE_ENV", "production");
		const first = serverFor("first");
		const second = serverFor("second");
		createCms({ config: testConfig, server: first.server }).store();
		const store = createCms({ config: testConfig, server: second.server }).store() as unknown as { tag: string };
		expect(store.tag).toBe("second");
		expect(first.database.createStore).toHaveBeenCalledTimes(1);
	});
});
