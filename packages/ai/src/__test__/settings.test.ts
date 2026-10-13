import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { fakeCms } from "@monti-cms/core/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { testSite } from "../../test/site";
import { resolveAction } from "../action";
import type { AiProviderInput } from "../connection";
import { moveKeysToStore } from "../migrate";
import { createDecider, createGenerator } from "../provider";
import { aiRegistryOf } from "../registry";
import {
	type AiSettingsStore,
	addAiProvider,
	connectionForCheck,
	getAiSettingsView,
	loadAiRuntime,
	removeAiProvider,
	updateAiProvider,
	usableActionKeys,
} from "../settings";
import { settingsMessages } from "../settings.messages";

/** An instance with a server secret, so its API key store works. */
const cmsWith = (secret = "test-secret", previousSecrets: string[] = []) =>
	fakeCms({ server: { secret, previousSecrets } });

/** What the key store lists as a connection's use, in the instance's language. */
const label = (cms: ReturnType<typeof cmsWith>, name: string) =>
	cms.site.createTranslator(settingsMessages)("keyUse", { name });

/** In-memory settings store over the instance's API key store. The version check matches the DB store. */
function memoryStore(cms = cmsWith()): AiSettingsStore & { value: unknown; cms: typeof cms } {
	const state = { value: undefined as unknown, version: 0 };
	return {
		cms,
		apiKeys: () => cms.apiKeys,
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
	key: { use: "new", value: "sk-chat-0000000000001234" },
	defaultModel: "m-default",
	...patch,
});

const decisions = (patch: Partial<AiProviderInput> = {}): AiProviderInput => ({
	name: "TypeSafe",
	kind: "decisions",
	url: "https://api.example.test/v1/systemone",
	key: { use: "new", value: "ts-key-0000000000009999" },
	defaultModel: "jev-latest",
	...patch,
});

const spec = (key: string, patch: { providerId?: string; modelName?: string } = {}) => {
	const definition = aiRegistryOf(testSite).actions[key];
	if (!definition) throw new Error(`Missing action: ${key}`);
	return resolveAction(key, definition, patch);
};

describe("AI connection settings", () => {
	beforeEach(() => vi.stubEnv("CMS_AI_FAKE", ""));
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it("saves a typed key into the key store, keeps only its id in the connection, and gives the screen the last four characters", async () => {
		const store = memoryStore();
		const view = await addAiProvider(testSite, store, 0, chat());
		expect(JSON.stringify(store.value)).not.toContain("sk-chat");
		expect((store.value as { providers: Array<{ url: string }> }).providers[0]?.url).toBe("https://example.test/v1");
		expect(view.providers[0]).toMatchObject({
			name: "OpenRouter",
			key: { name: "OpenRouter", tail: "1234" },
			ready: true,
		});
		expect(JSON.stringify(view)).not.toContain("sk-chat");

		const [key] = await store.cms.apiKeys.list();
		expect(await store.cms.apiKeys.read(key?.id ?? "")).toBe("sk-chat-0000000000001234");
		expect(key?.uses.map((use) => use.label)).toEqual([
			testSite.createTranslator(settingsMessages)("keyUse", { name: "OpenRouter" }),
		]);
	});

	it("names a second typed key after its connection with a number when the name is taken, and lets connections share a saved key", async () => {
		const store = memoryStore();
		await addAiProvider(testSite, store, 0, chat());
		const second = await addAiProvider(
			testSite,
			store,
			1,
			chat({ key: { use: "new", value: "sk-chat-0000000000005555" } }),
		);
		expect((await store.cms.apiKeys.list()).map((key) => key.name)).toEqual(["OpenRouter", "OpenRouter 2"]);

		const firstKey = second.providers[0]?.key?.id ?? "";
		const shared = await addAiProvider(
			testSite,
			store,
			2,
			chat({ name: "Other", key: { use: "saved", keyId: firstKey } }),
		);
		expect(shared.providers[2]?.key?.id).toBe(firstKey);
		expect((await store.cms.apiKeys.get(firstKey))?.uses).toHaveLength(2);
	});

	it("keeps several connections, keeps the key when none is sent, and does not carry the key to a different URL", async () => {
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

		const kept = await updateAiProvider(testSite, store, 2, id, chat({ key: undefined, defaultModel: "other" }));
		expect(kept.providers[0]).toMatchObject({ key: { tail: "1234" }, defaultModel: "other" });

		const moved = await updateAiProvider(
			testSite,
			store,
			3,
			id,
			chat({ key: undefined, url: "https://elsewhere.test/v1" }),
		);
		expect(moved.providers[0]?.key).toBeNull();

		const removed = await removeAiProvider(testSite, store, 4, id);
		expect(removed.providers.map((provider) => provider.name)).toEqual(["OpenCode Go"]);
		await expect(addAiProvider(testSite, store, 0, chat())).rejects.toMatchObject({ code: "conflict" });
	});

	it("removes a key it just saved when the connection cannot be saved (version conflict)", async () => {
		const store = memoryStore();
		await addAiProvider(testSite, store, 0, chat());
		await expect(
			addAiProvider(testSite, store, 0, chat({ name: "Again", key: { use: "new", value: "sk-another-000000000001" } })),
		).rejects.toMatchObject({
			code: "conflict",
		});
		expect(await store.cms.apiKeys.list()).toHaveLength(1);
	});

	it("deleting a connection frees its key's usage; the key itself stays in the store", async () => {
		const store = memoryStore();
		const view = await addAiProvider(testSite, store, 0, chat());
		await removeAiProvider(testSite, store, 1, view.providers[0]?.id ?? "");
		const [key] = await store.cms.apiKeys.list();
		expect(key?.uses).toEqual([]);
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

	it("reports only usable actions (dropped when there is no connection, or its key was deleted or cannot be decrypted)", async () => {
		const store = memoryStore();
		const view = await addAiProvider(testSite, store, 0, chat());
		const features = [spec("slug"), spec("tags")];
		expect(await usableActionKeys(testSite, store, features)).toEqual(["slug"]);

		const key = await store.cms.apiKeys.get(view.providers[0]?.key?.id ?? "");
		await store.cms.apiKeys.remove(key?.id ?? "", { expectedVersion: key?.version ?? 0 });
		expect(await usableActionKeys(testSite, store, features)).toEqual([]);
		expect((await getAiSettingsView(testSite, store)).providers[0]?.key).toBeNull();
	});

	it("replacing a key's value changes what every connection that uses it sends", async () => {
		const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ answers: {} }));
		vi.stubGlobal("fetch", fetchMock);
		const store = memoryStore();
		const view = await addAiProvider(testSite, store, 0, decisions());
		const key = view.providers[0]?.key;
		await store.cms.apiKeys.update(key?.id ?? "", { expectedVersion: 1, value: "ts-key-replaced-000000" });
		const runtime = await loadAiRuntime(testSite, store, spec("tags"));
		await runtime.decider?.decide({ state: { t: "x" }, questions: {} });
		expect(JSON.stringify(fetchMock.mock.calls[0]?.[1]?.headers)).toContain("ts-key-replaced-000000");
	});

	it("the pre-save connection check uses the input values, and uses the stored key only for the same URL when no key is given", async () => {
		const store = memoryStore();
		const view = await addAiProvider(testSite, store, 0, chat());
		const providerId = view.providers[0]?.id;
		const base = { providerId, kind: "chat" as const, url: "https://example.test/v1", model: "m-new" };

		const same = await connectionForCheck(testSite, store, base);
		expect(same.model).toBe("m-new");
		expect(same.generator?.model).toBe("m-new");

		await expect(
			connectionForCheck(testSite, store, { ...base, url: "https://elsewhere.test/v1" }),
		).rejects.toMatchObject({ message: "키를 넣으세요." });
		const typed = await connectionForCheck(testSite, store, {
			...base,
			url: "https://elsewhere.test/v1",
			key: { use: "new", value: "new-key" },
		});
		expect(typed.generator).toBeDefined();
		// A typed key is only used for the check: it is not saved.
		expect(await store.cms.apiKeys.list()).toHaveLength(1);
		await expect(connectionForCheck(testSite, store, { ...base, key: { use: "none" } })).rejects.toMatchObject({
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

	it("refuses to save a typed key when the instance has no secret, and says how to fix it", async () => {
		const store = memoryStore(fakeCms());
		await expect(addAiProvider(testSite, store, 0, chat())).rejects.toMatchObject({ code: "secret_not_configured" });
	});
});

/** A key as the plugin stored it before per-plugin keys: `v1:<iv>:<tag>:<body>` under `sha256("cms-ai-key:" + secret)`. */
function legacyKey(plain: string, masterSecret: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(`cms-ai-key:${masterSecret}`).digest(), iv);
	const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
	return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(":");
}

/** Plugin storage holding settings as the previous version wrote them: the key ciphertext inside each connection. */
function oldSettings(cms: ReturnType<typeof cmsWith>, providers: unknown[]) {
	const settings = cms.storage("ai").collection("settings");
	return {
		storage: cms.storage("ai"),
		save: () => settings.set("default", { providers }, { expectedVersion: 0 }),
		settings,
	};
}

describe("moving the keys stored in connections into the key store (db:migrate)", () => {
	beforeEach(() => vi.stubEnv("CMS_AI_FAKE", ""));
	afterEach(() => vi.unstubAllEnvs());

	const connection = (id: string, name: string, apiKey: string | null) => ({
		id,
		name,
		kind: "chat",
		url: "https://example.test/v1",
		apiKey,
		defaultModel: "m",
	});

	it("moves keys in the per-plugin and the oldest format, shares one key between connections that had the same value, and leaves ids behind", async () => {
		const cms = cmsWith();
		const modern = cms.secrets("ai").encrypt("sk-chat-0000000000001234");
		const { storage, save, settings } = oldSettings(cms, [
			connection("a", "Claude", modern),
			connection("b", "Translate", modern),
			connection("c", "Old", legacyKey("sk-old-0000000000007777", "test-secret")),
			connection("d", "No key", null),
		]);
		await save();

		expect(await moveKeysToStore(storage, cms)).toBe(2);
		const keys = await cms.apiKeys.list();
		expect(keys.map((key) => key.name).sort()).toEqual(["Claude", "Old"]);
		expect(JSON.stringify((await settings.get("default"))?.value)).not.toContain("apiKey");
		const claude = keys.find((key) => key.name === "Claude");
		expect(claude?.uses.map((use) => use.label).sort()).toEqual([label(cms, "Claude"), label(cms, "Translate")]);
		expect(await cms.apiKeys.read(claude?.id ?? "")).toBe("sk-chat-0000000000001234");

		// The connections work through the store afterwards, and running it again changes nothing.
		const view = await getAiSettingsView(testSite, {
			...memoryStore(cms),
			getAiSettings: async () => (await settings.get("default")) ?? null,
			saveAiSettings: async () => 0,
		});
		expect(view.providers.map((provider) => provider.ready)).toEqual([true, true, true, false]);
		expect(await moveKeysToStore(storage, cms)).toBe(0);
		expect(await cms.apiKeys.list()).toHaveLength(2);
	});

	it("leaves a connection without a key when its stored key cannot be decrypted any more", async () => {
		const cms = cmsWith("new-secret");
		const { storage, save, settings } = oldSettings(cms, [
			connection("a", "Claude", cms.secrets("ai", { legacy: { prefix: "v1", domain: "cms-ai-key:" } }).encrypt("x")),
			connection("b", "Lost", legacyKey("sk-lost", "forgotten-secret")),
		]);
		await save();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		expect(await moveKeysToStore(storage, cms)).toBe(1);
		warn.mockRestore();
		const stored = (await settings.get("default"))?.value as {
			providers: Array<{ name: string; keyId: string | null }>;
		};
		expect(stored.providers.map((provider) => [provider.name, provider.keyId !== null])).toEqual([
			["Claude", true],
			["Lost", false],
		]);
	});

	it("reads settings saved in the pair shape (one generate and one decide connection) and shares their key", async () => {
		const cms = cmsWith();
		const key = cms.secrets("ai").encrypt("sk-pair-0000000000001111");
		const settings = cms.storage("ai").collection("settings");
		await settings.set(
			"default",
			{
				generate: { baseUrl: "https://example.test/v1", apiKey: key, smallModel: "m" },
				decide: { url: "https://example.test/decisions", apiKey: null, shareKey: true, model: "jev" },
			},
			{ expectedVersion: 0 },
		);
		await moveKeysToStore(cms.storage("ai"), cms);
		const stored = (await settings.get("default"))?.value as {
			providers: Array<{ kind: string; keyId: string | null }>;
		};
		expect(stored.providers.map((provider) => provider.kind)).toEqual(["chat", "decisions"]);
		expect(new Set(stored.providers.map((provider) => provider.keyId)).size).toBe(1);
		expect(await cms.apiKeys.list()).toHaveLength(1);
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
