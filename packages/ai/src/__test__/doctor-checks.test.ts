import { fakeCms } from "@monti-cms/core/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../test/site";
import aiServer from "../server";

/** The AI plugin's check for `monti doctor`: is a connection saved and usable. */

const state = vi.hoisted(() => ({ settings: undefined as unknown, fail: false }));
vi.mock("../store", () => ({
	aiStoreFor: () => ({
		secrets: () => ({
			available: true,
			decrypt: (value: string) => (value.startsWith("enc:") ? value.slice(4) : null),
		}),
		getAiSettings: async () => {
			if (state.fail) throw new Error("database down");
			return state.settings ? { value: state.settings, version: 1 } : null;
		},
		listAiActionOverrides: async () => [],
	}),
}));

afterEach(() => {
	state.settings = undefined;
	state.fail = false;
	vi.unstubAllEnvs();
});

const check = aiServer.checks?.find((item) => item.id === "connection");

const run = (secret: string | null = "a-long-test-secret") =>
	Promise.resolve(
		check?.run({
			cms: fakeCms({ config: testConfig, server: secret ? { secret } : {} }),
			cwd: "/app",
			env: {},
			online: false,
		}),
	);

describe("AI checks for monti doctor", () => {
	it("is one check named connection", () => {
		expect(aiServer.checks?.map((item) => item.id)).toEqual(["connection"]);
	});

	it("warns when no connection is saved, naming the screen and what to enter", async () => {
		const result = await run();
		expect(result?.status).toBe("warn");
		expect(result?.message).toContain("no AI connection is saved");
		expect(result?.where).toContain("/ai");
		expect(result?.fix).toContain("https://openrouter.ai/api/v1");
	});

	it("fails when there is no MONTI_SECRET to keep a key with", async () => {
		const result = await run(null);
		expect(result?.status).toBe("fail");
		expect(result?.message).toContain("MONTI_SECRET");
		expect(result?.fix).toContain("openssl rand");
	});

	it("warns about a connection that lacks its key or model, and passes with a ready one", async () => {
		state.settings = {
			providers: [
				{
					id: "a",
					name: "OpenRouter",
					kind: "chat",
					url: "https://openrouter.ai/api/v1",
					apiKey: null,
					defaultModel: "",
				},
			],
		};
		const incomplete = await run();
		expect(incomplete?.status).toBe("warn");
		expect(incomplete?.message).toContain("OpenRouter");
		expect(incomplete?.fix).toContain("default model");

		state.settings = {
			providers: [
				{
					id: "a",
					name: "OpenRouter",
					kind: "chat",
					url: "https://openrouter.ai/api/v1",
					apiKey: "enc:sk-test-1234",
					defaultModel: "google/gemini-2.5-flash",
				},
			],
		};
		const ready = await run();
		expect(ready?.status).toBe("ok");
		expect(ready?.message).toContain("OpenRouter");
		expect(JSON.stringify(ready)).not.toContain("sk-test");
	});

	it("skips when the saved connections cannot be read, and passes for the fake development connection", async () => {
		state.fail = true;
		expect((await run())?.status).toBe("skip");
		state.fail = false;
		vi.stubEnv("CMS_AI_FAKE", "1");
		vi.stubEnv("NODE_ENV", "development");
		expect((await run())?.status).toBe("ok");
	});
});
