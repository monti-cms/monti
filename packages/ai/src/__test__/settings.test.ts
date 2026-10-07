import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { fakeCms } from "@monti-cms/core/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { testSite } from "../../test/site";
import { resolveAction } from "../action";
import type { AiProviderInput } from "../connection";
import { createDecider, createGenerator } from "../provider";
import { aiRegistryOf } from "../registry";
import { aiSecrets, decryptSecret } from "../secret";
import {
	type AiSettingsStore,
	addAiProvider,
	connectionForCheck,
	getAiSettingsView,
	loadAiRuntime,
	removeAiProvider,
	updateAiProvider,
	upgradeStoredKeys,
	usableActionKeys,
} from "../settings";

/** The encryption key the in-memory stores use. A test changes `current` to simulate a rotated `secret`. */
const secret = { current: "test-secret", previous: [] as string[] };

/** The AI plugin's secrets API as the instance with the given master secrets hands it out. */
const secretsFor = (current: string, previous: string[] = []) =>
	aiSecrets(fakeCms({ server: { secret: current, previousSecrets: previous } }));

/** In-memory settings store. The version check matches the DB store. */
function memoryStore(): AiSettingsStore & { value: unknown } {
	const state = { value: undefined as unknown, version: 0 };
	return {
		secrets: () => secretsFor(secret.current, secret.previous),
		get value() {
			return state.value;
		},
		getAiSettings: async () => (state.version === 0 ? null : { value: state.value, version: state.version }),
		saveAiSettings: async ({ expectedVersion, value }) => {
			if (expectedVersion !== state.version) throw Object.assign(new Error("Conflict"), { code: "conflict" });
			state.value = value;
			state.version += 1;
			return state.version;
		},
	};
}

const chat = (patch: Partial<AiProviderInput> = {}): AiProviderInput => ({
	name: "OpenRouter",
	kind: "chat",
	url: "https://example.test/v1/",
	apiKey: "sk-chat-1234",
	defaultModel: "m-default",
	...patch,
});

const decisions = (patch: Partial<AiProviderInput> = {}): AiProviderInput => ({
	name: "TypeSafe",
	kind: "decisions",
	url: "https://api.example.test/v1/systemone",
	apiKey: "ts-key-9999",
	defaultModel: "jev-latest",
	...patch,
});

const spec = (key: string, patch: { providerId?: string; modelName?: string } = {}) => {
	const definition = aiRegistryOf(testSite).actions[key];
	if (!definition) throw new Error(`Missing action: ${key}`);
	return resolveAction(key, definition, patch);
};

describe("AI connection settings", () => {
	beforeEach(() => {
		secret.current = "test-secret";
		secret.previous = [];
		vi.stubEnv("CMS_AI_FAKE", "");
	});
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it("encrypts the key for storage and gives the screen only its last four characters", async () => {
		const store = memoryStore();
		const view = await addAiProvider(testSite, store, 0, chat());
		const stored = store.value as { providers: Array<{ apiKey: string; url: string }> };
		expect(stored.providers[0]?.apiKey).not.toContain("sk-chat");
		expect(decryptSecret(stored.providers[0]?.apiKey ?? "", secretsFor("test-secret"))).toBe("sk-chat-1234");
		expect(stored.providers[0]?.url).toBe("https://example.test/v1");
		expect(view.providers[0]).toMatchObject({ name: "OpenRouter", keyHint: "…1234", ready: true });
		expect(JSON.stringify(view)).not.toContain("sk-chat");
	});

	it("keeps several connections, keeps the key when none is sent, clears it on null, and clears the old key when the URL changes", async () => {
		const store = memoryStore();
		await addAiProvider(testSite, store, 0, chat());
		const added = await addAiProvider(
			testSite,
			store,
			1,
			chat({ name: "OpenCode Go", url: "https://go.example.test/v1" }),
		);
		expect(added.providers.map((provider) => provider.name)).toEqual(["OpenRouter", "OpenCode Go"]);
		const id = added.providers[0]?.id ?? "";

		const kept = await updateAiProvider(testSite, store, 2, id, chat({ apiKey: undefined, defaultModel: "other" }));
		expect(kept.providers[0]).toMatchObject({ keyHint: "…1234", defaultModel: "other" });

		const moved = await updateAiProvider(
			testSite,
			store,
			3,
			id,
			chat({ apiKey: undefined, url: "https://elsewhere.test/v1" }),
		);
		expect(moved.providers[0]?.keyHint).toBeNull();

		const removed = await removeAiProvider(testSite, store, 4, id);
		expect(removed.providers.map((provider) => provider.name)).toEqual(["OpenCode Go"]);
		await expect(addAiProvider(testSite, store, 0, chat())).rejects.toMatchObject({ code: "conflict" });
	});

	it("an action uses its chosen connection and model, and falls back to the first connection of the matching kind and its default model when empty", async () => {
		const fetchMock = vi.fn(async (_url: string) => Response.json({ answers: {} }));
		vi.stubGlobal("fetch", fetchMock);
		const store = memoryStore();
		await addAiProvider(testSite, store, 0, chat());
		const view = await addAiProvider(testSite, store, 1, decisions());
		const chatId = view.providers[0]?.id ?? "";

		const auto = await loadAiRuntime(testSite, store, spec("slug"));
		expect(auto.generator?.model).toBe("m-default");
		expect(auto.decider).toBeNull();

		const picked = await loadAiRuntime(testSite, store, spec("slug", { providerId: chatId, modelName: "m-other" }));
		expect(picked.generator?.model).toBe("m-other");

		const decide = await loadAiRuntime(testSite, store, spec("tags"));
		expect(decide.decider?.model).toBe("jev-latest");
		await decide.decider?.decide({ state: { t: "x" }, questions: {} });
		expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.example.test/v1/systemone");

		// A decide action with a generate connection chosen does not use it.
		expect((await loadAiRuntime(testSite, store, spec("tags", { providerId: chatId }))).decider).toBeNull();
	});

	it("reports only usable actions (dropped when there is no connection or the key cannot be decrypted)", async () => {
		const store = memoryStore();
		await addAiProvider(testSite, store, 0, chat());
		const features = [spec("slug"), spec("tags")];
		expect(await usableActionKeys(testSite, store, features)).toEqual(["slug"]);
		secret.current = "rotated";
		expect(await usableActionKeys(testSite, store, features)).toEqual([]);
		expect((await getAiSettingsView(testSite, store)).providers[0]?.keyHint).toBeNull();
	});

	it("settings saved in the old shape (one generate and one decide pair) are read as two connections", async () => {
		const store = memoryStore();
		await store.saveAiSettings({
			expectedVersion: 0,
			value: {
				generate: { baseUrl: "https://example.test/v1", apiKey: null, smallModel: "m", largeModel: "l" },
				decide: { url: "https://example.test/decisions", apiKey: null, shareKey: true, model: "jev" },
			},
		});
		const view = await getAiSettingsView(testSite, store);
		expect(view.providers.map((provider) => [provider.kind, provider.defaultModel])).toEqual([
			["chat", "m"],
			["decisions", "jev"],
		]);
	});

	it("the pre-save connection check uses the input values, and uses the stored key only for the same URL when no new key is given", async () => {
		const store = memoryStore();
		const view = await addAiProvider(testSite, store, 0, chat());
		const providerId = view.providers[0]?.id;
		const base = { providerId, kind: "chat" as const, url: "https://example.test/v1", model: "m-new" };

		const same = await connectionForCheck(testSite, store, base);
		expect(same.model).toBe("m-new");
		expect(same.generator?.model).toBe("m-new");

		await expect(
			connectionForCheck(testSite, store, { ...base, url: "https://elsewhere.test/v1" }),
		).rejects.toMatchObject({
			message: "키를 넣으세요.",
		});
		const typed = await connectionForCheck(testSite, store, {
			...base,
			url: "https://elsewhere.test/v1",
			apiKey: "new-key",
		});
		expect(typed.generator).toBeDefined();
		await expect(connectionForCheck(testSite, store, { ...base, apiKey: null })).rejects.toMatchObject({
			code: "ai_unavailable",
		});
	});

	it("with the development fake connection every action is usable without a connection", async () => {
		vi.stubEnv("CMS_AI_FAKE", "1");
		const store = memoryStore();
		expect(await usableActionKeys(testSite, store, [spec("tags")])).toEqual(["tags"]);
		const runtime = await loadAiRuntime(testSite, store, spec("tags"));
		expect(runtime.decider?.name).toBe("fake");
	});
});

/** A key as the plugin stored it before per-plugin keys: `v1:<iv>:<tag>:<body>` under `sha256("cms-ai-key:" + secret)`. */
function legacyKey(plain: string, masterSecret: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(`cms-ai-key:${masterSecret}`).digest(), iv);
	const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
	return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(":");
}

/** A store holding settings saved by the old plugin version, with the key in the legacy format. */
async function storeWithLegacyKey(masterSecret: string) {
	const store = memoryStore();
	await store.saveAiSettings({
		expectedVersion: 0,
		value: {
			providers: [
				{
					id: "p1",
					name: "OpenRouter",
					kind: "chat",
					url: "https://example.test/v1",
					apiKey: legacyKey("sk-chat-1234", masterSecret),
					defaultModel: "m-default",
				},
			],
		},
	});
	return store;
}

const storedKey = (store: { value: unknown }) =>
	(store.value as { providers: Array<{ apiKey: string }> }).providers[0]?.apiKey ?? "";

describe("AI service keys stored before per-plugin keys", () => {
	beforeEach(() => {
		secret.current = "test-secret";
		secret.previous = [];
		vi.stubEnv("CMS_AI_FAKE", "");
	});
	afterEach(() => vi.unstubAllEnvs());

	it("still decrypt, so the connection stays ready without entering the key again", async () => {
		const store = await storeWithLegacyKey("test-secret");
		const view = await getAiSettingsView(testSite, store);
		expect(view.providers[0]).toMatchObject({ keyHint: "…1234", ready: true });
	});

	it("are encrypted again in the current format the next time any connection is saved", async () => {
		const store = await storeWithLegacyKey("test-secret");
		const before = storedKey(store);
		expect(before.startsWith("v1:")).toBe(true);

		// Saving another connection upgrades the key of the untouched one too.
		await addAiProvider(testSite, store, 1, decisions());
		const after = storedKey(store);
		expect(after.startsWith("mk1:")).toBe(true);
		expect(secretsFor("test-secret").decrypt(after)).toBe("sk-chat-1234");
		expect((await getAiSettingsView(testSite, store)).providers[0]).toMatchObject({ keyHint: "…1234", ready: true });
	});

	it("are upgraded by the migration step without any edit, and the step can be repeated", async () => {
		const store = await storeWithLegacyKey("test-secret");
		expect(await upgradeStoredKeys(testSite, store)).toBe(1);
		expect(storedKey(store).startsWith("mk1:")).toBe(true);
		const upgraded = storedKey(store);
		expect(await upgradeStoredKeys(testSite, store)).toBe(0);
		expect(storedKey(store)).toBe(upgraded);
		expect((await getAiSettingsView(testSite, store)).providers[0]?.keyHint).toBe("…1234");
	});

	it("do nothing without a secret, and are left alone when they cannot be decrypted", async () => {
		const store = await storeWithLegacyKey("other-secret");
		const before = storedKey(store);
		expect(await upgradeStoredKeys(testSite, store)).toBe(0);
		expect(storedKey(store)).toBe(before);
		expect((await getAiSettingsView(testSite, store)).providers[0]?.keyHint).toBeNull();
	});
});

describe("AI service keys when the secret is rotated", () => {
	beforeEach(() => {
		secret.current = "test-secret";
		secret.previous = [];
		vi.stubEnv("CMS_AI_FAKE", "");
	});
	afterEach(() => vi.unstubAllEnvs());

	it("stay readable through previousSecrets, and are encrypted with the new secret on the next save", async () => {
		const store = memoryStore();
		await addAiProvider(testSite, store, 0, chat());
		secret.current = "rotated";
		expect((await getAiSettingsView(testSite, store)).providers[0]?.keyHint).toBeNull();

		secret.previous = ["test-secret"];
		expect((await getAiSettingsView(testSite, store)).providers[0]).toMatchObject({ keyHint: "…1234", ready: true });
		expect(await upgradeStoredKeys(testSite, store)).toBe(1);

		// Once upgraded, the old secret can be dropped from the list.
		secret.previous = [];
		expect((await getAiSettingsView(testSite, store)).providers[0]).toMatchObject({ keyHint: "…1234", ready: true });
	});

	it("upgrade legacy keys written under a previous secret in one step", async () => {
		const store = await storeWithLegacyKey("test-secret");
		secret.current = "rotated";
		secret.previous = ["test-secret"];
		expect(await upgradeStoredKeys(testSite, store)).toBe(1);
		secret.previous = [];
		expect((await getAiSettingsView(testSite, store)).providers[0]?.keyHint).toBe("…1234");
	});

	it("refuses to store a key when the instance has no secret", async () => {
		const store = memoryStore();
		store.secrets = () => aiSecrets(fakeCms());
		await expect(addAiProvider(testSite, store, 0, chat())).rejects.toMatchObject({ code: "ai_unavailable" });
	});
});

describe("decide model call", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("sends model, state and questions to the decide URL and reads answers", async () => {
		const fetchMock = vi.fn(async () =>
			Response.json({ answers: { o0: { type: "noul", noul: 0.8 } }, usage: { input_tokens: 10 } }),
		);
		vi.stubGlobal("fetch", fetchMock);
		const decider = createDecider(testSite, {
			url: "https://example.test/decisions",
			apiKey: "key",
			model: "typesafe/jev-1.13",
		});
		const answers = await decider.decide({
			state: { title: "t" },
			questions: { o0: { type: "noul", instructions: "i", criteria: { true: "y", false: "n" } } },
		});
		expect(answers).toEqual({ o0: { type: "noul", noul: 0.8 } });
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe("https://example.test/decisions");
		expect((init.headers as Record<string, string>).Authorization).toBe("Bearer key");
		expect(JSON.parse(String(init.body))).toMatchObject({ model: "typesafe/jev-1.13", state: { title: "t" } });
	});

	it("turns key errors, insufficient credit and malformed answers into understandable errors", async () => {
		const decider = createDecider(testSite, { url: "https://example.test/decisions", apiKey: "key", model: "m" });
		const request = { state: { t: "x" }, questions: {} };
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("nope", { status: 401 })),
		);
		await expect(decider.decide(request)).rejects.toMatchObject({ code: "ai_unavailable" });
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("nope", { status: 402 })),
		);
		await expect(decider.decide(request)).rejects.toMatchObject({ message: "AI 서비스 크레딧이 부족합니다. — nope" });
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => Response.json({ result: "?" })),
		);
		await expect(decider.decide(request)).rejects.toMatchObject({ code: "ai_failed" });
	});
});

describe("generation model call", () => {
	afterEach(() => vi.unstubAllGlobals());

	const completion = (content: string) =>
		Response.json({
			id: "c1",
			object: "chat.completion",
			created: 0,
			model: "m-small",
			choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
			usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
		});

	const request = {
		system: "s",
		content: [{ type: "text" as const, text: "t" }],
		schema: z.object({ candidates: z.array(z.string()) }),
		maxTokens: 100,
		result: "candidates" as const,
		fake: { inputs: {} },
	};

	it("requests a fixed JSON shape and reads the answer", async () => {
		const fetchMock = vi.fn(async () => completion('{"candidates":["a","b"]}'));
		vi.stubGlobal("fetch", fetchMock);
		const generator = createGenerator(testSite, {
			baseUrl: "https://example.test/v1",
			apiKey: "key",
			model: "m-small",
		});
		expect(await generator.generate(request)).toEqual({ candidates: ["a", "b"] });
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe("https://example.test/v1/chat/completions");
		const body = JSON.parse(String(init.body));
		expect(body.model).toBe("m-small");
		expect(body.response_format?.type).toBe("json_schema");
	});

	it("retries in JSON mode when the service does not accept json_schema", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ error: { message: "response_format not supported" } }, { status: 400 }))
			.mockResolvedValueOnce(completion('{"candidates":["a"]}'));
		vi.stubGlobal("fetch", fetchMock);
		const generator = createGenerator(testSite, {
			baseUrl: "https://example.test/v1",
			apiKey: "key",
			model: "m-small",
		});
		expect(await generator.generate(request)).toEqual({ candidates: ["a"] });
		const second = JSON.parse(String((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body));
		expect(second.response_format?.type).not.toBe("json_schema");
	});

	it("when no shape option is supported (404), falls back to JSON mode, then plain text, and extracts only the JSON", async () => {
		const notFound = () =>
			Response.json(
				{ error: { message: "No endpoints found that support the requested parameters" } },
				{ status: 404 },
			);
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(notFound())
			.mockResolvedValueOnce(notFound())
			.mockResolvedValueOnce(completion('후보입니다.\n```json\n{"candidates":["a"]}\n```'));
		vi.stubGlobal("fetch", fetchMock);
		const generator = createGenerator(testSite, { baseUrl: "https://example.test/v1", apiKey: "key", model: "m" });
		expect(await generator.generate(request)).toEqual({ candidates: ["a"] });
		const bodies = fetchMock.mock.calls.map((call) =>
			JSON.parse(String((call as unknown as [string, RequestInit])[1].body)),
		);
		expect(bodies.map((body) => body.response_format?.type)).toEqual(["json_schema", "json_object", undefined]);
	});

	it("when everything fails, reports it with the explanation sent by the service", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				Response.json({ error: { message: "No endpoints found matching your data policy" } }, { status: 404 }),
			),
		);
		const generator = createGenerator(testSite, { baseUrl: "https://example.test/v1", apiKey: "key", model: "m" });
		await expect(generator.generate(request)).rejects.toMatchObject({
			message: "AI 서비스 주소나 모델 이름을 확인하세요. — No endpoints found matching your data policy",
		});
	});

	it("a service error (5xx) is reported as a service problem, not a format error, even after the SDK retries", async () => {
		const fetchMock = vi.fn(async () =>
			Response.json({ error: { message: "Provider returned error" } }, { status: 502 }),
		);
		vi.stubGlobal("fetch", fetchMock);
		const generator = createGenerator(testSite, { baseUrl: "https://example.test/v1", apiKey: "key", model: "m" });
		await expect(generator.generate(request)).rejects.toMatchObject({
			message: "AI 서비스에 문제가 있습니다. — Provider returned error",
		});
	});

	it("when the answer is cut off at the output limit, reports the truncation instead of retrying another way", async () => {
		const truncated = Response.json({
			id: "c1",
			object: "chat.completion",
			created: 0,
			model: "m",
			choices: [{ index: 0, message: { role: "assistant", content: '{"candidates":["a' }, finish_reason: "length" }],
			usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
		});
		const fetchMock = vi.fn(async () => truncated.clone());
		vi.stubGlobal("fetch", fetchMock);
		const generator = createGenerator(testSite, { baseUrl: "https://example.test/v1", apiKey: "key", model: "m" });
		await expect(generator.generate(request)).rejects.toMatchObject({
			message: expect.stringContaining("끝까지 받지 못했습니다"),
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("when the key is wrong, reports it without retrying", async () => {
		const fetchMock = vi.fn(async () => Response.json({ error: { message: "bad key" } }, { status: 401 }));
		vi.stubGlobal("fetch", fetchMock);
		const generator = createGenerator(testSite, {
			baseUrl: "https://example.test/v1",
			apiKey: "key",
			model: "m-small",
		});
		await expect(generator.generate(request)).rejects.toMatchObject({ code: "ai_unavailable" });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
