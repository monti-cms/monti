import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCms } from "../../cms";
import { defineFormat } from "../../format/types";
import type { WriteHooks } from "../../services/hooks";
import type { CmsPlugin } from "../define";
import { createServerPlugins } from "../server";

const cms = fakeCms();

/** The server side of the plugins of one site, with the server config's hooks. Each call is its own instance (nothing is shared between them). */
const serverPlugins = (plugins: readonly unknown[], hooks?: WriteHooks) =>
	createServerPlugins(
		plugins as readonly CmsPlugin[],
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
				default: { features: async (c: typeof first) => ({ [`trusted-${c.isHostTrusted()}`]: true }) },
			}),
		};
		const plugins = [plugin] as unknown as readonly CmsPlugin[];
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
	it("lists the server config's hooks first, then the plugins' in config order, each with its owner", async () => {
		const serverHooks = { validate: () => undefined };
		const aHooks = { transform: () => undefined };
		const bHooks = { validatePublish: () => undefined };
		const plugins = serverPlugins(
			[
				{ name: "plain" },
				{ name: "alpha", server: async () => ({ default: { hooks: aHooks } }) },
				{ name: "no-hooks", server: async () => ({ default: {} }) },
				{ name: "beta", server: async () => ({ default: { hooks: bHooks } }) },
			],
			serverHooks,
		);
		expect(await plugins.writeHooks()).toEqual([
			{ owner: "server", hooks: serverHooks },
			{ owner: "plugin:alpha", hooks: aHooks },
			{ owner: "plugin:beta", hooks: bHooks },
		]);
	});

	it("is empty when nothing registers hooks", async () => {
		expect(await serverPlugins([{ name: "plain" }]).writeHooks()).toEqual([]);
	});
});

describe("inline hooks", () => {
	it("runs the hooks of a plugin that has no server module, after the server config's and in the plugin order", async () => {
		const inline = { validate: () => undefined };
		const lazy = { validate: () => undefined };
		const serverHooks = { validate: () => undefined };
		const plugins = serverPlugins(
			[
				{ name: "inline", hooks: inline },
				{ name: "lazy", server: async () => ({ default: { hooks: lazy } }) },
			],
			serverHooks,
		);
		expect(await plugins.writeHooks()).toEqual([
			{ owner: "server", hooks: serverHooks },
			{ owner: "plugin:inline", hooks: inline },
			{ owner: "plugin:lazy", hooks: lazy },
		]);
	});

	it("keeps the other parts of the server module of a plugin that also has inline hooks", async () => {
		const plugins = serverPlugins([
			{
				name: "both",
				hooks: { validate: () => undefined },
				server: async () => ({ default: { features: async () => ({ ready: true }) } }),
			},
		]);
		expect(await plugins.features()).toEqual({ both: { ready: true } });
		expect((await plugins.writeHooks()).map((source) => source.owner)).toEqual(["plugin:both"]);
	});

	it("refuses a plugin that sets hooks both inline and in its server module", async () => {
		const plugins = serverPlugins([
			{
				name: "twice",
				hooks: { validate: () => undefined },
				server: async () => ({ default: { hooks: { validate: () => undefined } } }),
			},
		]);
		await expect(plugins.writeHooks()).rejects.toThrow(/"twice".*inline.*server module/);
	});
});

describe("eventSubscribers", () => {
	it("lists the server config's afterCommit and then each plugin's, named by owner, skipping hooks without one", async () => {
		const seen: string[] = [];
		const afterCommit = (name: string) => () => void seen.push(name);
		const plugins = serverPlugins(
			[
				{ name: "a", server: async () => ({ default: { hooks: { afterCommit: afterCommit("a") } } }) },
				{ name: "no-after-commit", server: async () => ({ default: { hooks: { validate: () => undefined } } }) },
				{ name: "b", hooks: { afterCommit: afterCommit("b") } },
			],
			{ afterCommit: afterCommit("server") },
		);
		const subscribers = await plugins.eventSubscribers();
		expect(subscribers.map((subscriber) => subscriber.name)).toEqual(["server", "plugin:a", "plugin:b"]);
		for (const subscriber of subscribers) await subscriber.handler({ eventId: "e1" } as never);
		expect(seen).toEqual(["server", "a", "b"]);
	});

	it("hands the instance to every afterCommit: the server config's, an inline plugin's and a server module's", async () => {
		const calls: string[] = [];
		const event = { eventId: "e1" } as never;
		const hook = (name: string) => async (incoming: unknown, instance: unknown) =>
			void calls.push(`${name}:${incoming === event}:${instance === cms}`);
		const plugins = serverPlugins(
			[
				{ name: "inline", hooks: { afterCommit: hook("inline") } },
				{ name: "lazy", server: async () => ({ default: { hooks: { afterCommit: hook("lazy") } } }) },
			],
			{ afterCommit: hook("server") },
		);
		for (const subscriber of await plugins.eventSubscribers()) await subscriber.handler(event);
		expect(calls).toEqual(["server:true:true", "inline:true:true", "lazy:true:true"]);
	});

	it("is empty when nothing registers afterCommit", async () => {
		expect(await serverPlugins([{ name: "plain" }]).eventSubscribers()).toEqual([]);
	});
});

describe("migrate", () => {
	it("migrates each plugin that has migrations, in order, with its own storage and the instance", async () => {
		const order: string[] = [];
		const storageOf = (plugin: string) => ({ plugin }) as never;
		const plugins = serverPlugins([
			{
				name: "one",
				server: async () => ({
					default: {
						migrate: async (storage: { plugin: string }, c: unknown) =>
							void order.push(`one:${storage.plugin}:${c === cms}`),
					},
				}),
			},
			{ name: "none", server: async () => ({ default: {} }) },
			{ name: "two", server: async () => ({ default: { migrate: async () => void order.push("two") } }) },
		]);
		await plugins.migrate(storageOf, () => undefined);
		expect(order).toEqual(["one:one:true", "two"]);
	});
});

describe("formats", () => {
	const format = (name: string) =>
		defineFormat({ name, label: name, mimeType: "text/plain", extension: name, export: () => name });

	it("has no format with no plugins, and lists the formats of the plugins in the order of the plugins", async () => {
		const registry = await serverPlugins([
			{ name: "one", formats: async () => ({ default: format("hugo") }) },
			{ name: "two", formats: async () => ({ default: [format("zola"), format("jekyll")] }) },
			{ name: "plain" },
		]).formats();

		expect(registry.list().map((item) => item.name)).toEqual(["hugo", "zola", "jekyll"]);
		expect((await serverPlugins([]).formats()).list()).toEqual([]);
	});

	it("loads the plugins' formats once, and hands out the same registry afterwards", async () => {
		const load = vi.fn(async () => ({ default: format("hugo") }));
		const plugins = serverPlugins([{ name: "one", formats: load }]);

		const first = await plugins.formats();
		const second = await plugins.formats();

		expect(second).toBe(first);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("fails when two formats have one name, and tries again on the next call", async () => {
		let name = "same";
		const plugins = serverPlugins([
			{ name: "one", formats: async () => ({ default: format("same") }) },
			{ name: "two", formats: async () => ({ default: format(name) }) },
		]);

		await expect(plugins.formats()).rejects.toThrow(/"same" is provided twice/);
		name = "hugo";
		expect((await plugins.formats()).get("hugo")).toBeDefined();

		await expect(
			serverPlugins([
				{ name: "one", formats: async () => ({ default: format("same") }) },
				{ name: "two", formats: async () => ({ default: format("same") }) },
			]).formats(),
		).rejects.toThrow(/"same" is provided twice/);
	});

	it("is the registry the instance gives (`cms.formats()`), with the formats a test adds", async () => {
		const withFormat = fakeCms({ formats: [format("hugo")] });

		expect((await withFormat.formats()).list().map((item) => item.name)).toEqual(["hugo"]);
		expect((await fakeCms().formats()).list()).toEqual([]);
	});
});
