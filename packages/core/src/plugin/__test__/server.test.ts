import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	plugins: [] as unknown[],
	attempts: 0,
}));

vi.mock("../../config/resolved", () => ({
	cmsConfig: {
		get plugins() {
			return state.plugins;
		},
	},
}));
vi.mock("../../server/resolved", () => ({ cmsServerConfig: {} }));

// `PLUGINS`는 모듈을 읽을 때 정해지므로, 시험마다 모듈을 새로 읽는다.
const load = async () => {
	vi.resetModules();
	return import("../server");
};

beforeEach(() => {
	state.attempts = 0;
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
		// 성공하면 다시 읽지 않는다.
		await loadServerPlugins();
		expect(state.attempts).toBe(2);
	});
});
