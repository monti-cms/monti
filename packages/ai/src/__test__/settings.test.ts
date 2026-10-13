import { fakeCms } from "@monti-cms/core/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { testSite } from "../../test/site";
import { resolveAction } from "../action";
import type { AiProviderInput } from "../connection";
import { AI_PLUGIN_NAME } from "../plugin-name";
import { createDecider, createGenerator } from "../provider";
import { aiRegistryOf } from "../registry";
import {
	addAiProvider,
	connectionForCheck,
	connectionRef,
	getAiSettingsView,
	keyUseLabels,
	loadAiRuntime,
	removeAiProvider,
	updateAiProvider,
	usableActionKeys,
} from "../settings";
import { settingsMessages } from "../settings.messages";
import { createAiStore } from "../store";

/** An instance with a server secret, so its API key store works. */
const cmsWith = (secret = "test-secret", previousSecrets: string[] = []) =>
	fakeCms({ server: { secret, previousSecrets } });

/** The settings store over the instance's own plugin storage and key store, writing through its transactions like the app does. */
function memoryStore(cms = cmsWith()) {
	const store = createAiStore(cms.storage(AI_PLUGIN_NAME), {
		site: testSite,
		apiKeys: () => cms.apiKeys,
		transaction: (work) => cms.transaction((tx) => work(tx.storage(AI_PLUGIN_NAME), tx.apiKeys)),
	});
	return Object.assign(store, { cms });
}

/** The settings row as stored. */
const storedValue = async (store: ReturnType<typeof memoryStore>) => (await store.getAiSettings())?.value;

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
		expect(JSON.stringify(await storedValue(store))).not.toContain("sk-chat");
		expect(((await storedValue(store)) as { providers: Array<{ url: string }> }).providers[0]?.url).toBe(
			"https://example.test/v1",
		);
		expect(view.providers[0]).toMatchObject({
			name: "OpenRouter",
			key: { name: "OpenRouter", tail: "1234" },
			ready: true,
		});
		expect(JSON.stringify(view)).not.toContain("sk-chat");

		const [key] = await store.cms.apiKeys.list();
		expect(await store.cms.apiKeys.read(key?.id ?? "")).toBe("sk-chat-0000000000001234");
		expect(key?.uses.map((use) => use.ref)).toEqual([connectionRef(view.providers[0]?.id ?? "")]);
		// Only the reference is stored, never text in some language.
		expect(JSON.stringify(await store.cms.storage("core-keys").collection("uses").list())).not.toContain("OpenRouter");
	});

	it("works out each connection's label when asked: its current name in the admin language, and none once the connection is deleted", async () => {
		const store = memoryStore();
		const view = await addAiProvider(testSite, store, 0, chat());
		const id = view.providers[0]?.id ?? "";
		const ref = connectionRef(id);
		const t = testSite.createTranslator(settingsMessages);
		expect(await keyUseLabels(testSite, store, [ref])).toEqual({ [ref]: t("keyUse", { name: "OpenRouter" }) });

		await updateAiProvider(testSite, store, 1, id, chat({ name: "Renamed", key: undefined }));
		expect(await keyUseLabels(testSite, store, [ref])).toEqual({ [ref]: t("keyUse", { name: "Renamed" }) });

		await removeAiProvider(testSite, store, 2, id);
		expect(await keyUseLabels(testSite, store, [ref])).toEqual({ [ref]: null });
		expect((await store.cms.apiKeys.list())[0]?.uses).toEqual([]);
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
		await store.cms.apiKeys.remove(key?.id ?? "", { expectedVersion: key?.version ?? 0, force: true });
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
			code: "service_unavailable",
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
		await expect(decider.decide(request)).rejects.toMatchObject({ code: "service_unavailable" });
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("nope", { status: 402 })),
		);
		await expect(decider.decide(request)).rejects.toMatchObject({ message: "AI 서비스 크레딧이 부족합니다. — nope" });
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => Response.json({ result: "?" })),
		);
		await expect(decider.decide(request)).rejects.toMatchObject({ code: "upstream_failed" });
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
		await expect(generator.generate(request)).rejects.toMatchObject({ code: "service_unavailable" });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
