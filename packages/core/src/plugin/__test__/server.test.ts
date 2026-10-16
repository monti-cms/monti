import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCms } from "../../cms";
import { defineFormat } from "../../format/types";
import type { PluginScope, WriteHooks } from "../../services/hooks";
import type { Plugin } from "../define";
import { createServerPlugins } from "../server";

const cms = fakeCms();

/** The server side of the plugins of one site, with the server config's hooks. Each call is its own instance (nothing is shared between them). */
const serverPlugins = (plugins: readonly unknown[], hooks?: WriteHooks) =>
	createServerPlugins(
		plugins as readonly Plugin[],
		() => ({ hooks }),
		() => cms,
	);

beforeEach(() => {
	vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("features", () => {
	it("puts each plugin's features under its name and skips plugins without or with failing features", async () => {
		const plugins = serverPlugins([
			{ name: "ai", server: async () => ({ default: { features: async () => ({ ready: true }) } }) },
			{ name: "seo", server: async () => ({ default: {} }) },
			{ name: "broken", server: async () => ({ default: { features: async () => Promise.reject(new Error("x")) } }) },
			{ name: "plain" },
		]);
		expect(await plugins.features()).toEqual({ ai: { ready: true } });
	});

	it("hands the instance to a plugin's features, so the plugin reads its own instance's data", async () => {
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
	it("does not cache a failed import, so a retry can succeed", async () => {
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

	it("keeps what it loaded per set of plugins: two sites do not share loaded modules", async () => {
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
	it("lists the checks before the save: the server config's lists first, then the plugins' in config order, each list in its order", async () => {
		const ran: string[] = [];
		const check = (name: string) => () => void ran.push(name);
		const plugins = serverPlugins(
			[
				{ name: "plain" },
				{
					name: "alpha",
					server: async () => ({ default: { hooks: { transform: [check("alpha-1"), check("alpha-2")] } } }),
				},
				{ name: "no-hooks", server: async () => ({ default: {} }) },
				{ name: "beta", server: async () => ({ default: { hooks: { validatePublish: [check("beta")] } } }) },
			],
			{ validate: [check("server-1"), check("server-2")] },
		);
		const sources = await plugins.writeHooks();
		expect(sources.map((source) => [source.owner, Object.keys(source.hooks)])).toEqual([
			["server", ["validate"]],
			["server", ["validate"]],
			["plugin:alpha", ["transform"]],
			["plugin:alpha", ["transform"]],
			["plugin:beta", ["validatePublish"]],
		]);
		for (const { hooks } of sources) await (hooks.transform ?? hooks.validate ?? hooks.validatePublish)?.({} as never);
		expect(ran).toEqual(["server-1", "server-2", "alpha-1", "alpha-2", "beta"]);
	});

	it("leaves the subscribers after the save out of the checks", async () => {
		const plugins = serverPlugins([], { afterCommit: [{ name: "notify", run: () => undefined }] });
		expect(await plugins.writeHooks()).toEqual([]);
	});

	it("is empty when nothing registers hooks", async () => {
		expect(await serverPlugins([{ name: "plain" }]).writeHooks()).toEqual([]);
	});
});

describe("inline server", () => {
	it("runs the hooks of a plugin whose server is given inline, after the server config's and in the plugin order", async () => {
		const check = { validate: [() => undefined] };
		const plugins = serverPlugins(
			[
				{ name: "inline", server: { hooks: check } },
				{ name: "lazy", server: async () => ({ default: { hooks: check } }) },
			],
			check,
		);
		expect((await plugins.writeHooks()).map((source) => source.owner)).toEqual([
			"server",
			"plugin:inline",
			"plugin:lazy",
		]);
	});

	it("keeps every part of an inline server, not only its hooks", async () => {
		const plugins = serverPlugins([
			{
				name: "both",
				server: { hooks: { validate: [() => undefined] }, features: async () => ({ ready: true }) },
			},
		]);
		expect(await plugins.features()).toEqual({ both: { ready: true } });
		expect((await plugins.writeHooks()).map((source) => source.owner)).toEqual(["plugin:both"]);
	});
});

describe("eventSubscribers", () => {
	it("makes each afterCommit entry its own subscriber, named <owner>:<name>, the server config's first and then the plugins' in order", async () => {
		const seen: string[] = [];
		const subscriber = (name: string) => ({ name, run: () => void seen.push(name) });
		const plugins = serverPlugins(
			[
				{
					name: "a",
					server: async () => ({ default: { hooks: { afterCommit: [subscriber("index"), subscriber("notify")] } } }),
				},
				{ name: "no-after-commit", server: async () => ({ default: { hooks: { validate: [() => undefined] } } }) },
				{ name: "b", server: { hooks: { afterCommit: [subscriber("sync")] } } },
			],
			{ afterCommit: [subscriber("revalidate")] },
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

	it("hands every afterCommit its scope: the instance, and a plugin's own context for a plugin's subscriber", async () => {
		const calls: string[] = [];
		const event = { eventId: "e1" } as never;
		const subscriber = (name: string) => ({
			name,
			run: async (incoming: unknown, scope: { readonly cms: unknown; readonly plugin?: { readonly name: string } }) =>
				void calls.push(`${name}:${incoming === event}:${scope.cms === cms}:${scope.plugin?.name ?? "-"}`),
		});
		const plugins = serverPlugins(
			[
				{ name: "inline", server: { hooks: { afterCommit: [subscriber("inline")] } } },
				{ name: "lazy", server: async () => ({ default: { hooks: { afterCommit: [subscriber("lazy")] } } }) },
			],
			{ afterCommit: [subscriber("server")] },
		);
		for (const item of await plugins.eventSubscribers()) await item.handler(event);
		expect(calls).toEqual(["server:true:true:-", "inline:true:true:inline", "lazy:true:true:lazy"]);
	});

	it("refuses a subscriber name that is not valid or that its owner uses twice", async () => {
		const run = () => undefined;
		await expect(serverPlugins([], { afterCommit: [{ name: "Sync Now", run }] }).eventSubscribers()).rejects.toThrow(
			/afterCommit of server: "Sync Now" is not a valid subscriber name/,
		);
		await expect(
			serverPlugins([
				{
					name: "a",
					server: {
						hooks: {
							afterCommit: [
								{ name: "sync", run },
								{ name: "sync", run },
							],
						},
					},
				},
			]).eventSubscribers(),
		).rejects.toThrow(/afterCommit of plugin:a: the subscriber name "sync" is used twice/);
	});

	it("is empty when nothing registers afterCommit", async () => {
		expect(await serverPlugins([{ name: "plain" }]).eventSubscribers()).toEqual([]);
	});
});

describe("migrate", () => {
	it("migrates each plugin that has migrations, in order, with its own context and the instance", async () => {
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

	it("has no format with no plugins, and lists the formats of the plugins in the order of the plugins", async () => {
		const registry = await serverPlugins([
			{ name: "one", server: { formats: async () => format("hugo") } },
			{ name: "two", server: { formats: async () => [format("zola"), format("jekyll")] } },
			{ name: "plain" },
		]).formats();

		expect(registry.list().map((item) => item.name)).toEqual(["hugo", "zola", "jekyll"]);
		expect((await serverPlugins([]).formats()).list()).toEqual([]);
	});

	it("loads the plugins' formats once, and hands out the same registry afterwards", async () => {
		const load = vi.fn(async () => format("hugo"));
		const plugins = serverPlugins([{ name: "one", server: { formats: load } }]);

		const first = await plugins.formats();
		const second = await plugins.formats();

		expect(second).toBe(first);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("fails when two formats have one name, and tries again on the next call", async () => {
		let name = "same";
		const plugins = serverPlugins([
			{ name: "one", server: { formats: async () => format("same") } },
			{ name: "two", server: { formats: async () => format(name) } },
		]);

		await expect(plugins.formats()).rejects.toThrow(/"same" is provided twice/);
		name = "hugo";
		expect((await plugins.formats()).get("hugo")).toBeDefined();

		await expect(
			serverPlugins([
				{ name: "one", server: { formats: async () => format("same") } },
				{ name: "two", server: { formats: async () => format("same") } },
			]).formats(),
		).rejects.toThrow(/"same" is provided twice/);
	});

	it("is the registry the instance gives (`cms.formats()`), with the formats a test adds", async () => {
		const withFormat = fakeCms({ formats: [format("hugo")] });

		expect((await withFormat.formats()).list().map((item) => item.name)).toEqual(["hugo"]);
		expect((await fakeCms().formats()).list()).toEqual([]);
	});
});
