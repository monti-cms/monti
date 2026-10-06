import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCms } from "../../cms";
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

describe("notifyAfterCommit", () => {
	const change = { kind: "saved", entryId: "e1" } as never;

	it("calls the server config's afterCommit and then each plugin's, in order", async () => {
		const calls: string[] = [];
		const plugins = serverPlugins(
			[
				{ name: "a", server: async () => ({ default: { hooks: { afterCommit: () => void calls.push("a") } } }) },
				{ name: "b", server: async () => ({ default: { hooks: { afterCommit: () => void calls.push("b") } } }) },
			],
			{ afterCommit: () => void calls.push("server") },
		);
		await plugins.notifyAfterCommit(change);
		expect(calls).toEqual(["server", "a", "b"]);
	});

	it("keeps calling the rest when one afterCommit fails, and never throws", async () => {
		const calls: string[] = [];
		const plugins = serverPlugins(
			[{ name: "a", server: async () => ({ default: { hooks: { afterCommit: () => void calls.push("a") } } }) }],
			{
				afterCommit: async () => {
					throw new Error("down");
				},
			},
		);
		await expect(plugins.notifyAfterCommit(change)).resolves.toBeUndefined();
		expect(calls).toEqual(["a"]);
	});
});

describe("migrate", () => {
	it("migrates each plugin that has migrations, in order, with the database and the instance", async () => {
		const order: string[] = [];
		const database = { schema: "s" } as never;
		const plugins = serverPlugins([
			{
				name: "one",
				server: async () => ({
					default: {
						migrate: async (db: unknown, c: unknown) => void order.push(`one:${db === database}:${c === cms}`),
					},
				}),
			},
			{ name: "none", server: async () => ({ default: {} }) },
			{ name: "two", server: async () => ({ default: { migrate: async () => void order.push("two") } }) },
		]);
		await plugins.migrate(database, () => undefined);
		expect(order).toEqual(["one:true:true", "two"]);
	});
});
