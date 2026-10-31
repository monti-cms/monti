import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCms } from "../../cms";
import { defineFormat } from "../../format/types";
import type { PluginScope, ServerEvents } from "../../services/reactions";
import type { Plugin } from "../define";
import { createServerPlugins } from "../server";

const cms = fakeCms();

/** The server side of the plugins of one site, with the server config's hooks. Each call is its own instance (nothing is shared between them). */
const serverPlugins = (plugins: readonly unknown[], hooks?: ServerEvents) =>
	createServerPlugins(
		plugins as readonly Plugin[],
		() => ({ on: hooks }),
		() => cms,
	);

beforeEach(() => {
	vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("features", () => {
	it("PLUG-S5 puts each plugin's features under its name and skips plugins without or with failing features", async () => {
		const plugins = serverPlugins([
			{ name: "ai", server: async () => ({ default: { features: async () => ({ ready: true }) } }) },
			{ name: "seo", server: async () => ({ default: {} }) },
			{ name: "broken", server: async () => ({ default: { features: async () => Promise.reject(new Error("x")) } }) },
			{ name: "plain" },
		]);
		expect(await plugins.features()).toEqual({ ai: { ready: true } });
	});

	it("PLUG-S6 hands the instance to a plugin's features, so the plugin reads its own instance's data", async () => {
		const first = fakeCms({ server: { trustHost: true } });
		const second = fakeCms({ server: { trustHost: false } });
		const plugin = {
			name: "echo",
			server: async () => ({
				default: {
					features: async ({ cms: c }: { cms: typeof first }) => ({ [`trusted-${c.isHostTrusted()}`]: true }),
				},
			}),
		};
		const plugins = [plugin] as unknown as readonly Plugin[];
		expect(
			await createServerPlugins(
				plugins,
				() => ({}),
				() => first,
			).features(),
		).toEqual({ echo: { "trusted-true": true } });
		expect(
			await createServerPlugins(
				plugins,
				() => ({}),
				() => second,
			).features(),
		).toEqual({ echo: { "trusted-false": true } });
	});
});

describe("load", () => {
	it("PLUG-S5 does not cache a failed import, so a retry can succeed", async () => {
		let attempts = 0;
		const plugins = serverPlugins([
			{
				name: "flaky",
				server: async () => {
					attempts += 1;
					if (attempts === 1) throw new Error("import failed");
					return { default: { routes: [{ pattern: "v1/flaky", module: {} }] } };
				},
			},
		]);
		await expect(plugins.load()).rejects.toThrow("import failed");
		expect(await plugins.routes()).toEqual([{ pattern: "v1/flaky", module: {}, plugin: "flaky" }]);
		expect(attempts).toBe(2);
		// Once it succeeds, it is not read again.
		await plugins.load();
		expect(attempts).toBe(2);
	});

	it("PLUG-S5 keeps what it loaded per set of plugins: two sites do not share loaded modules", async () => {
		let loads = 0;
		const plugin = {
			name: "counted",
			server: async () => ({ default: { routes: [{ pattern: `v1/n${++loads}`, module: {} }] } }),
		};
		const a = serverPlugins([plugin]);
		const b = serverPlugins([plugin]);
		expect((await a.routes()).map((route) => route.pattern)).toEqual(["v1/n1"]);
		expect((await b.routes()).map((route) => route.pattern)).toEqual(["v1/n2"]);
		expect((await a.routes()).map((route) => route.pattern)).toEqual(["v1/n1"]);
	});
});

describe("writeHooks", () => {
	it("WRITE-H3 lists the checks before the save: the server config's lists first, then the plugins' in config order, each list in its order", async () => {
		const ran: string[] = [];
		const check = (name: string) => () => void ran.push(name);
		const plugins = serverPlugins(
			[
				{ name: "plain" },
				{
					name: "alpha",
					server: async () => ({
						default: { on: { entry: { beforeValidate: [check("alpha-1"), check("alpha-2")] } } },
					}),
				},
				{ name: "no-hooks", server: async () => ({ default: {} }) },
				{ name: "beta", server: async () => ({ default: { on: { entry: { beforePublish: [check("beta")] } } } }) },
			],
			{ entry: { beforeSave: [check("server-1"), check("server-2")] } },
		);
		const sources = await plugins.writeHooks();
		expect(sources.map((source) => [source.owner, Object.keys(source.hooks)])).toEqual([
			["server", ["beforeSave"]],
			["server", ["beforeSave"]],
			["plugin:alpha", ["beforeValidate"]],
			["plugin:alpha", ["beforeValidate"]],
			["plugin:beta", ["beforePublish"]],
		]);
		for (const { hooks } of sources)
			await (hooks.beforeValidate ?? hooks.beforeSave ?? hooks.beforePublish)?.({} as never);
		expect(ran).toEqual(["server-1", "server-2", "alpha-1", "alpha-2", "beta"]);
	});

	it("leaves the subscribers after the save out of the checks", async () => {
		const plugins = serverPlugins([], { entry: { changed: [{ name: "notify", run: () => undefined }] } });
		expect(await plugins.writeHooks()).toEqual([]);
	});

	it("is empty when nothing registers hooks", async () => {
		expect(await serverPlugins([{ name: "plain" }]).writeHooks()).toEqual([]);
	});
});

describe("plugin order", () => {
	it("runs the subscribers of each plugin after the server config's, in the plugin order", async () => {
		const check = { beforeSave: [() => undefined] };
		const plugins = serverPlugins(
			[
				{ name: "first", server: async () => ({ default: { on: { entry: check } } }) },
				{ name: "second", server: async () => ({ default: { on: { entry: check } } }) },
			],
			{ entry: check },
		);
		expect((await plugins.writeHooks()).map((source) => source.owner)).toEqual([
			"server",
			"plugin:first",
			"plugin:second",
		]);
	});

	it("keeps every part of a server module, not only its subscribers", async () => {
		const plugins = serverPlugins([
			{
				name: "both",
				server: async () => ({
					default: { on: { entry: { beforeSave: [() => undefined] } }, features: async () => ({ ready: true }) },
				}),
			},
		]);
		expect(await plugins.features()).toEqual({ both: { ready: true } });
		expect((await plugins.writeHooks()).map((source) => source.owner)).toEqual(["plugin:both"]);
	});
});

describe("eventSubscribers", () => {
	it("PLUG-S7 makes each afterCommit entry its own subscriber, named <owner>:<name>, the server config's first and then the plugins' in order", async () => {
		const seen: string[] = [];
		const subscriber = (name: string) => ({ name, run: () => void seen.push(name) });
		const plugins = serverPlugins(
			[
				{
					name: "a",
					server: async () => ({
						default: { on: { entry: { changed: [subscriber("index"), subscriber("notify")] } } },
					}),
				},
				{
					name: "no-after-commit",
					server: async () => ({ default: { on: { entry: { beforeSave: [() => undefined] } } } }),
				},
				{ name: "b", server: async () => ({ default: { on: { entry: { changed: [subscriber("sync")] } } } }) },
			],
			{ entry: { changed: [subscriber("revalidate")] } },
		);
		const subscribers = await plugins.eventSubscribers();
		expect(subscribers.map((item) => item.name)).toEqual([
			"server:revalidate",
			"plugin:a:index",
			"plugin:a:notify",
			"plugin:b:sync",
		]);
		for (const item of subscribers) await item.handler({ eventId: "e1" } as never);
		expect(seen).toEqual(["revalidate", "index", "notify", "sync"]);
	});

	it("PLUG-S6 hands every afterCommit its scope: the instance, and a plugin's own context for a plugin's subscriber", async () => {
		const calls: string[] = [];
		const event = { eventId: "e1" } as never;
		const subscriber = (name: string) => ({
			name,
			run: async (incoming: unknown, scope: { readonly cms: unknown; readonly plugin?: { readonly name: string } }) =>
				void calls.push(`${name}:${incoming === event}:${scope.cms === cms}:${scope.plugin?.name ?? "-"}`),
		});
		const plugins = serverPlugins(
			[
				{ name: "inline", server: async () => ({ default: { on: { entry: { changed: [subscriber("inline")] } } } }) },
				{ name: "lazy", server: async () => ({ default: { on: { entry: { changed: [subscriber("lazy")] } } } }) },
			],
			{ entry: { changed: [subscriber("server")] } },
		);
		for (const item of await plugins.eventSubscribers()) await item.handler(event);
		expect(calls).toEqual(["server:true:true:-", "inline:true:true:inline", "lazy:true:true:lazy"]);
	});

	it("PLUG-S7 refuses a subscriber name that is not valid or that its owner uses twice", async () => {
		const run = () => undefined;
		await expect(
			serverPlugins([], { entry: { changed: [{ name: "Sync Now", run }] } }).eventSubscribers(),
		).rejects.toThrow(/on\.entry\.changed of server: "Sync Now" is not a valid subscriber name/);
		await expect(
			serverPlugins([
				{
					name: "a",
					server: async () => ({
						default: {
							on: {
								entry: {
									changed: [
										{ name: "sync", run },
										{ name: "sync", run },
									],
								},
							},
						},
					}),
				},
			]).eventSubscribers(),
		).rejects.toThrow(/on\.entry of plugin:a: the subscriber name "sync" is used twice/);
	});

	it("is empty when nothing registers afterCommit", async () => {
		expect(await serverPlugins([{ name: "plain" }]).eventSubscribers()).toEqual([]);
	});
});

describe("events by kind", () => {
	const run = () => undefined;

	it("PLUG-S7 delivers a subscriber only the kind it is listed under, and a `changed` one every kind", async () => {
		const plugins = serverPlugins([], {
			entry: {
				published: [{ name: "slack", run }],
				changed: [{ name: "log", run }],
				deleted: [{ name: "purge", run }],
			},
		});
		const kinds = Object.fromEntries((await plugins.eventSubscribers()).map((item) => [item.name, item.kinds]));
		expect(kinds["server:slack"]).toEqual(["published"]);
		expect(kinds["server:purge"]).toEqual(["deleted"]);
		expect(kinds["server:log"]).toEqual([
			"created",
			"saved",
			"published",
			"archived",
			"unarchived",
			"trashed",
			"restored",
			"deleted",
		]);
	});

	it("PLUG-S7 refuses one name under two kinds: a subscriber is one outbox key", async () => {
		await expect(
			serverPlugins([], {
				entry: { saved: [{ name: "sync", run }], published: [{ name: "sync", run }] },
			}).eventSubscribers(),
		).rejects.toThrow(/the subscriber name "sync" is used twice/);
	});

	it("KEY-P1 tells a plugin's keySlot.changed subscribers which slot changed, with the plugin's scope", async () => {
		const calls: string[] = [];
		const plugins = serverPlugins([
			{
				name: "sync",
				server: async () => ({
					default: {
						on: {
							keySlot: {
								changed: [
									async ({ slot }: { slot: string }, { plugin }: PluginScope) =>
										void calls.push(`${plugin.name}:${slot}`),
								],
							},
						},
					},
				}),
			},
			{ name: "other", server: async () => ({ default: {} }) },
		]);
		await plugins.keySlotChanged("sync", "token");
		await plugins.keySlotChanged("other", "token");
		await plugins.keySlotChanged("missing", "token");
		expect(calls).toEqual(["sync:token"]);
	});
});

describe("migrate", () => {
	it("PLUG-S8 migrates each plugin that has migrations, in order, with its own context and the instance", async () => {
		const order: string[] = [];
		const plugins = serverPlugins([
			{
				name: "one",
				server: async () => ({
					default: {
						migrate: async ({ cms: c, plugin }: PluginScope) => void order.push(`one:${plugin.name}:${c === cms}`),
					},
				}),
			},
			{ name: "none", server: async () => ({ default: {} }) },
			{ name: "two", server: async () => ({ default: { migrate: async () => void order.push("two") } }) },
		]);
		await plugins.migrate(() => undefined);
		expect(order).toEqual(["one:one:true", "two"]);
	});
});

describe("formats", () => {
	const format = (name: string) =>
		defineFormat({ name, label: name, mimeType: "text/plain", extension: name, export: () => name });

	it("FMT-P1 has no format with no plugins, and lists the formats of the plugins in the order of the plugins", async () => {
		const registry = await serverPlugins([
			{ name: "one", server: async () => ({ default: { formats: async () => format("hugo") } }) },
			{ name: "two", server: async () => ({ default: { formats: async () => [format("zola"), format("jekyll")] } }) },
			{ name: "plain" },
		]).formats();

		expect(registry.list().map((item) => item.name)).toEqual(["hugo", "zola", "jekyll"]);
		expect((await serverPlugins([]).formats()).list()).toEqual([]);
	});

	it("loads the plugins' formats once, and hands out the same registry afterwards", async () => {
		const load = vi.fn(async () => format("hugo"));
		const plugins = serverPlugins([{ name: "one", server: async () => ({ default: { formats: load } }) }]);

		const first = await plugins.formats();
		const second = await plugins.formats();

		expect(second).toBe(first);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("PLUG-S5 fails when two formats have one name, and tries again on the next call", async () => {
		let name = "same";
		const plugins = serverPlugins([
			{ name: "one", server: async () => ({ default: { formats: async () => format("same") } }) },
			{ name: "two", server: async () => ({ default: { formats: async () => format(name) } }) },
		]);

		await expect(plugins.formats()).rejects.toThrow(/"same" is provided twice/);
		name = "hugo";
		expect((await plugins.formats()).list().map((item) => item.name)).toEqual(["same", "hugo"]);

		await expect(
			serverPlugins([
				{ name: "one", server: async () => ({ default: { formats: async () => format("same") } }) },
				{ name: "two", server: async () => ({ default: { formats: async () => format("same") } }) },
			]).formats(),
		).rejects.toThrow(/"same" is provided twice/);
	});

	it("is the registry the instance gives (`cms.formats()`), with the formats a test adds", async () => {
		const withFormat = fakeCms({ formats: [format("hugo")] });

		expect((await withFormat.formats()).list().map((item) => item.name)).toEqual(["hugo"]);
		expect((await fakeCms().formats()).list()).toEqual([]);
	});
});
