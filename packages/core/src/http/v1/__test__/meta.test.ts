import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getMeta } from "../meta/route";

const serverConfig = vi.hoisted(() => ({ media: undefined as unknown }));
const pluginFeatures = vi.hoisted(() => ({ value: {} as Record<string, Record<string, boolean>> }));

vi.mock("../../../adapters/auth", () => ({
	authGateway: { verifyAdmin: () => Promise.resolve({ userId: "admin" }) },
	AuthError: class AuthError extends Error {},
}));

vi.mock("../../../server/resolved", () => ({ cmsServerConfig: serverConfig }));

vi.mock("../../../plugin/server", () => ({ pluginFeatures: () => Promise.resolve(pluginFeatures.value) }));

const readFeatures = async () => {
	const res = await getMeta(new NextRequest("http://localhost/api/cms/v1/meta"));
	expect(res.status).toBe(200);
	return (await res.json()).features as Record<string, boolean | Record<string, boolean>>;
};

describe("GET /v1/meta features.media", () => {
	beforeEach(() => {
		serverConfig.media = undefined;
		pluginFeatures.value = {};
	});

	it("is false when the server config has no media storage", async () => {
		expect((await readFeatures()).media).toBe(false);
	});

	it("is true when the server config has media storage", async () => {
		serverConfig.media = { createStore: () => ({}) };
		expect((await readFeatures()).media).toBe(true);
	});

	it("puts plugin features under the plugin name, next to the core ones", async () => {
		pluginFeatures.value = { ai: { ready: true } };
		const features = await readFeatures();
		expect(features.ai).toEqual({ ready: true });
		expect(features.folders).toBe(true);
		expect(features.ready).toBeUndefined();
	});
});
