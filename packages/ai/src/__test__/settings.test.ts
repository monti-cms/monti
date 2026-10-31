import { fakeCms } from "@monti-cms/core/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../test/site";
import { resolveAction } from "../action";
import type { AiProviderInput } from "../connection";
import { AI_PLUGIN_NAME } from "../name";
import { aiRegistryOf } from "../registry";
import { addAiProvider, connectionRef, loadAiRuntime, removeAiProvider, updateAiProvider } from "../settings";
import { createAiStore } from "../store";

/** An instance with a server secret, so its API key store works. */
const cmsWith = (secret = "test-secret", previousSecrets: string[] = []) =>
	fakeCms({ server: { secret, previousSecrets } });

/** The settings store over the instance's own plugin storage and key store, writing through its transactions like the app does. */
function memoryStore(cms = cmsWith()) {
	const store = createAiStore(cms.plugin(AI_PLUGIN_NAME).storage, {
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

	it("KEY-A1 saves a typed key into the key store, keeps only its id in the connection, and gives the screen the last four characters", async () => {
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
		expect(JSON.stringify(await store.cms.plugin("core-keys").storage.collection("uses").list())).not.toContain(
			"OpenRouter",
		);
	});

	it("KEY-A2 names a second typed key after its connection with a number when the name is taken, and lets connections share a saved key", async () => {
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

	it("KEY-A2 keeps several connections, keeps the key when none is sent, and does not carry the key to a different URL", async () => {
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

	it("KEY-A2 removes a key it just saved when the connection cannot be saved (version conflict)", async () => {
		const store = memoryStore();
		await addAiProvider(testSite, store, 0, chat());
		await expect(
			addAiProvider(testSite, store, 0, chat({ name: "Again", key: { use: "new", value: "sk-another-000000000001" } })),
		).rejects.toMatchObject({
			code: "conflict",
		});
		expect(await store.cms.apiKeys.list()).toHaveLength(1);
	});

	it("KEY-A2 deleting a connection frees its key's usage; the key itself stays in the store", async () => {
		const store = memoryStore();
		const view = await addAiProvider(testSite, store, 0, chat());
		await removeAiProvider(testSite, store, 1, view.providers[0]?.id ?? "");
		const [key] = await store.cms.apiKeys.list();
		expect(key?.uses).toEqual([]);
	});

	it("KEY-A2 replacing a key's value changes what every connection that uses it sends", async () => {
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

	it("KEY-A3 refuses to save a typed key when the instance has no secret, and says how to fix it", async () => {
		const store = memoryStore(fakeCms());
		await expect(addAiProvider(testSite, store, 0, chat())).rejects.toMatchObject({ code: "secret_not_configured" });
	});
});
