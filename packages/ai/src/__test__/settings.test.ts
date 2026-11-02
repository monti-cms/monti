import { definePlugin } from "@monti-cms/core";
import { fakeCms } from "@monti-cms/core/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig, testSite } from "../../test/site";
import { AI_PLUGIN_NAME } from "../name";
import { aiKeyServices } from "../services";
import { getAiSettingsView, keyConnection, keyUseLabels, loadAgentRuntime, setQuickModel } from "../settings";
import { createAiStore } from "../store";

/** The AI services as the key store sees them, without their checks (the checks call the services; they have their own test below). */
const services = definePlugin({
	name: "services",
	server: async () => ({
		default: {
			keyServices: () => [
				...aiKeyServices(testSite).map(({ check: _check, ...service }) => service),
				{ id: "bareun", label: "바른 맞춤법", group: "plugin" as const },
			],
		},
	}),
});

/** An instance with a server secret and the AI services, and the AI settings store over it. */
function setup() {
	const cms = fakeCms({ config: { ...testConfig, plugins: [services] } as never, server: { secret: "test-secret" } });
	const store = createAiStore(cms.plugin(AI_PLUGIN_NAME).storage, { site: testSite, apiKeys: () => cms.apiKeys });
	const add = (
		service: string,
		name: string,
		extra: { url?: string; value?: string } = { value: `${service}-key-0000000001` },
	) => cms.apiKeys.add({ service, name, ...extra });
	return { cms, store, add };
}

describe("AI keys are the connections", () => {
	beforeEach(() => vi.stubEnv("CMS_AI_FAKE", ""));
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it("KEY-K1 lists only the keys of AI services, and starts the quick tasks and a new conversation on the first key with a default model", async () => {
		const { store, add } = setup();
		await add("bareun", "바른 맞춤법");
		await add("openrouter", "OpenRouter");
		const anthropic = await add("anthropic", "Anthropic 개인");
		const view = await getAiSettingsView(testSite, store);
		expect(view.keys.map((key) => `${key.service}:${key.name}`)).toEqual([
			"openrouter:OpenRouter",
			"anthropic:Anthropic 개인",
		]);
		// OpenRouter has no model every account can run, so the defaults come from the Anthropic key.
		expect(view.quick).toEqual({ keyId: anthropic.id, model: "claude-haiku-5-5", keyName: "Anthropic 개인" });
		expect(view.assistant).toEqual({ keyId: anthropic.id, model: "claude-sonnet-5-5", keyName: "Anthropic 개인" });
	});

	it("KEY-K1 has no model to run on with no key, or only keys without a default", async () => {
		const { store, add } = setup();
		expect(await getAiSettingsView(testSite, store)).toMatchObject({ keys: [], quick: null, assistant: null });
		await add("openai-compatible", "Local", { url: "http://localhost:11434/v1" });
		expect(await getAiSettingsView(testSite, store)).toMatchObject({ quick: null, assistant: null });
	});

	it("KEY-K2 keeps the chosen quick-task model, refuses a key that is not an AI service's, and tells the key store what uses each key", async () => {
		const { cms, store, add } = setup();
		const anthropic = await add("anthropic", "Anthropic 개인");
		const openai = await add("openai", "OpenAI 회사");
		const speller = await add("bareun", "바른 맞춤법");
		await expect(setQuickModel(testSite, store, 0, { keyId: speller.id, model: "x" })).rejects.toMatchObject({
			code: "invalid_input",
		});
		const view = await setQuickModel(testSite, store, 0, { keyId: openai.id, model: "gpt-5-mini" });
		expect(view.quick).toEqual({ keyId: openai.id, model: "gpt-5-mini", keyName: "OpenAI 회사" });
		const uses = Object.fromEntries(
			(await cms.apiKeys.list()).map((key) => [key.name, key.uses.map((use) => use.ref)]),
		);
		expect(uses).toEqual({
			"Anthropic 개인": ["assistant:claude-sonnet-5-5"],
			"OpenAI 회사": ["quick:gpt-5-mini"],
			"바른 맞춤법": [],
		});
		expect(anthropic.id).not.toBe(openai.id);
	});

	it("KEY-K2 words each use with the model it serves, in the admin language", () => {
		expect(keyUseLabels(testSite, ["quick:gpt-5-mini", "assistant:claude-sonnet-5-5", "connection:old"])).toEqual({
			"quick:gpt-5-mini": { label: "빠른 작업", value: "gpt-5-mini" },
			"assistant:claude-sonnet-5-5": { label: "어시스턴트", value: "claude-sonnet-5-5 · 기본" },
			"connection:old": null,
		});
	});

	it("KEY-K3 calls a key's service at its own address, or the address the key carries, with the key's value", async () => {
		const { store, add } = setup();
		const anthropic = await add("anthropic", "Anthropic", { value: "sk-ant-0000000000001234" });
		const local = await add("openai-compatible", "Local", { url: "http://localhost:11434/v1/" });
		const speller = await add("bareun", "바른 맞춤법");
		expect(await keyConnection(store, anthropic.id)).toMatchObject({
			baseUrl: "https://api.anthropic.com/v1",
			apiKey: "sk-ant-0000000000001234",
			service: "anthropic",
		});
		expect(await keyConnection(store, local.id)).toMatchObject({ baseUrl: "http://localhost:11434/v1", apiKey: "" });
		expect(await keyConnection(store, speller.id)).toBeNull();
	});

	it("KEY-K3 counts the tokens of a call against the key", async () => {
		const { cms, store, add } = setup();
		const anthropic = await add("anthropic", "Anthropic");
		await (await keyConnection(store, anthropic.id))?.record(1500);
		expect((await cms.apiKeys.get(anthropic.id))?.usage).toBe(1500);
	});

	it("KEY-K4 runs a conversation on its own model, drops thinking for a model that cannot, and refuses with no key or a model that cannot use tools", async () => {
		const { store, add } = setup();
		await expect(loadAgentRuntime(testSite, store)).rejects.toMatchObject({ code: "service_unavailable" });
		const anthropic = await add("anthropic", "Anthropic");
		const router = await add("openrouter", "OpenRouter");
		const fallback = await loadAgentRuntime(testSite, store);
		expect(fallback).toMatchObject({ keyId: anthropic.id, modelName: "claude-sonnet-5-5", thinking: "off" });
		const thinking = await loadAgentRuntime(testSite, store, {
			keyId: anthropic.id,
			model: "claude-opus-5-5",
			thinking: "high",
		});
		expect(thinking).toMatchObject({ modelName: "claude-opus-5-5", thinking: "high" });
		const plain = await loadAgentRuntime(testSite, store, {
			keyId: router.id,
			model: "deepseek/deepseek-chat",
			thinking: "high",
		});
		expect(plain.thinking).toBe("off");
		await store.saveToolSupport({ keyId: router.id, model: "meta/llama-3-8b", supported: false });
		await expect(
			loadAgentRuntime(testSite, store, { keyId: router.id, model: "meta/llama-3-8b", thinking: "off" }),
		).rejects.toMatchObject({ code: "agent_unavailable" });
	});
});

describe("AI key check", () => {
	afterEach(() => vi.unstubAllGlobals());

	const checkOf = (id: string) => {
		const found = aiKeyServices(testSite).find((service) => service.id === id)?.check;
		if (!found) throw new Error(`no check for ${id}`);
		return found;
	};

	it("KEY-C1 asks the service's model list with the key: a refusal is a wrong key, a missing list is no verdict, anything else cannot reach it", async () => {
		const calls: { url: string; headers: Record<string, string> }[] = [];
		const answers = [401, 200, 404, 500];
		vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
			calls.push({ url, headers: init.headers as Record<string, string> });
			return new Response("{}", { status: answers.shift() ?? 200 });
		});
		const anthropic = checkOf("anthropic");
		expect(await anthropic({ url: "", value: "sk-ant-wrong" })).toBe("rejected");
		expect(await anthropic({ url: "", value: "sk-ant-right" })).toBe("ok");
		expect(await checkOf("openai-compatible")({ url: "http://localhost:11434/v1", value: null })).toBe("ok");
		await expect(checkOf("openai")({ url: "", value: "sk-x" })).rejects.toMatchObject({ code: "upstream_failed" });
		expect(calls.map((call) => call.url)).toEqual([
			"https://api.anthropic.com/v1/models",
			"https://api.anthropic.com/v1/models",
			"http://localhost:11434/v1/models",
			"https://api.openai.com/v1/models",
		]);
		expect(calls[0]?.headers).toMatchObject({ Authorization: "Bearer sk-ant-wrong", "x-api-key": "sk-ant-wrong" });
		expect(calls[2]?.headers).toEqual({});
	});
});
