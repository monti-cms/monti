import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	plugins: [] as unknown[],
	serverHooks: undefined as unknown,
	attempts: 0,
}));

vi.mock("../../config/resolved", () => ({
	cmsConfig: {
		get plugins() {
			return state.plugins;
		},
	},
}));
vi.mock("../../server/resolved", () => ({
	cmsServerConfig: {
		get hooks() {
			return state.serverHooks;
		},
	},
}));

// `PLUGINS` is fixed when the module is loaded, so each test loads the module anew.
const load = async () => {
	vi.resetModules();
	return import("../server");
};

beforeEach(() => {
	state.attempts = 0;
	state.serverHooks = undefined;
	vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("pluginFeatures", () => {
	it("puts each plugin's features under its name and skips plugins without or with failing features", async () => {
		state.plugins = [
			{ name: "ai", server: async () => ({ default: { features: async () => ({ ready: true }) } }) },
			{ name: "seo", server: async () => ({ default: {} }) },
			{ name: "broken", server: async () => ({ default: { features: async () => Promise.reject(new Error("x")) } }) },
			{ name: "plain" },
		];
		const { pluginFeatures } = await load();
		expect(await pluginFeatures()).toEqual({ ai: { ready: true } });
	});
});

describe("loadServerPlugins", () => {
	it("does not cache a failed import, so a retry can succeed", async () => {
		state.plugins = [
			{
				name: "flaky",
				server: async () => {
					state.attempts += 1;
					if (state.attempts === 1) throw new Error("import failed");
					return { default: { routes: [{ pattern: "v1/flaky", module: {} }] } };
				},
			},
		];
		const { loadServerPlugins, pluginRoutes } = await load();
		await expect(loadServerPlugins()).rejects.toThrow("import failed");
		expect(await pluginRoutes()).toEqual([{ pattern: "v1/flaky", module: {}, plugin: "flaky" }]);
		expect(state.attempts).toBe(2);
		// Once it succeeds, it is not read again.
		await loadServerPlugins();
		expect(state.attempts).toBe(2);
	});
});

describe("loadWriteHooks", () => {
	it("lists the server config's hooks first, then the plugins' in config order, each with its owner", async () => {
		const serverHooks = { validate: () => undefined };
		const aHooks = { transform: () => undefined };
		const bHooks = { validatePublish: () => undefined };
		state.serverHooks = serverHooks;
		state.plugins = [
			{ name: "plain" },
			{ name: "alpha", server: async () => ({ default: { hooks: aHooks } }) },
			{ name: "no-hooks", server: async () => ({ default: {} }) },
			{ name: "beta", server: async () => ({ default: { hooks: bHooks } }) },
		];
		const { loadWriteHooks } = await load();
		expect(await loadWriteHooks()).toEqual([
			{ owner: "server", hooks: serverHooks },
			{ owner: "plugin:alpha", hooks: aHooks },
			{ owner: "plugin:beta", hooks: bHooks },
		]);
	});

	it("is empty when nothing registers hooks", async () => {
		state.plugins = [{ name: "plain" }];
		const { loadWriteHooks } = await load();
		expect(await loadWriteHooks()).toEqual([]);
	});
});

describe("notifyAfterCommit", () => {
	const change = { kind: "saved", entryId: "e1" } as never;

	it("calls the server config's afterCommit and then each plugin's, in order", async () => {
		const calls: string[] = [];
		state.serverHooks = { afterCommit: () => void calls.push("server") };
		state.plugins = [
			{ name: "a", server: async () => ({ default: { hooks: { afterCommit: () => void calls.push("a") } } }) },
			{ name: "b", server: async () => ({ default: { hooks: { afterCommit: () => void calls.push("b") } } }) },
		];
		const { notifyAfterCommit } = await load();
		await notifyAfterCommit(change);
		expect(calls).toEqual(["server", "a", "b"]);
	});

	it("keeps calling the rest when one afterCommit fails, and never throws", async () => {
		const calls: string[] = [];
		state.serverHooks = {
			afterCommit: async () => {
				throw new Error("down");
			},
		};
		state.plugins = [
			{ name: "a", server: async () => ({ default: { hooks: { afterCommit: () => void calls.push("a") } } }) },
		];
		const { notifyAfterCommit } = await load();
		await expect(notifyAfterCommit(change)).resolves.toBeUndefined();
		expect(calls).toEqual(["a"]);
	});
});
