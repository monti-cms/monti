import { defineOperation } from "@monti-cms/core/server";
import { fakeCms, routeCaller } from "@monti-cms/core/testing";
import { APICallError, simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { testConfig, testSite } from "../../test/site";
import { MAX_AGENT_STEPS, startAgentRun } from "../agent";
import type { AgentRequest } from "../agent-request";
import { MAX_RUN_CHARS } from "../agent-store";
import { POST as postAgentHandler } from "../routes/agent/route";
import { GET as getRunHandler } from "../routes/agent/runs/[id]/route";
import { GET as listRunsHandler } from "../routes/agent/runs/route";
import { POST as checkHandler } from "../routes/providers/check/route";
import { GET as getSettingsHandler, PUT as putSettingsHandler } from "../routes/settings/route";
import { type AgentRuntime, addAiProvider, getAiSettingsView } from "../settings";
import { aiStoreFor } from "../store";

const postAgent = routeCaller(postAgentHandler);
const listRuns = routeCaller(listRunsHandler);
const getRun = routeCaller(getRunHandler);
const check = routeCaller(checkHandler);
const getSettings = routeCaller(getSettingsHandler);
const putSettings = routeCaller(putSettingsHandler);

let admin = { userId: "admin-1", accountId: "g", isAdmin: true as const };

const cms = fakeCms({
	config: testConfig,
	server: { secret: "test-secret" },
	verifyAdmin: async () => admin,
	plugins: [
		{
			name: "probe",
			operations: [
				defineOperation({
					name: "probe.number",
					kind: "read",
					describe: "Returns the number it is given.",
					input: () => z.object({ n: z.number() }),
					run: ({ n }) => ({ n }),
				}),
			],
		},
	],
});

const url = (path: string) => `http://localhost/api/monti/v1/ai/${path}`;
const send = (path: string, method: string, body?: unknown) =>
	new Request(url(path), {
		method,
		headers: { origin: "http://localhost", "content-type": "application/json" },
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});

const userMessage = (text: string, id = "m1") => ({ id, role: "user" as const, parts: [{ type: "text", text }] });
const request = (text: string, extra: Partial<AgentRequest> = {}) => ({
	messages: [userMessage(text)],
	context: { screen: "entries" },
	...extra,
});

/** A chunk of a UI message stream answer; tests read into it freely. */
// biome-ignore lint/suspicious/noExplicitAny: the shape of a chunk depends on its type
type Chunk = Record<string, any>;

/** The chunks of a UI message stream answer. */
async function chunksOf(response: Response): Promise<Chunk[]> {
	return (await response.text())
		.split("\n")
		.filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
		.map((line) => JSON.parse(line.slice(6)));
}

const textOf = (chunks: Chunk[]) =>
	chunks
		.filter((chunk) => chunk.type === "text-delta")
		.map((chunk) => chunk.delta)
		.join("");

describe("the agent route on the fake model", () => {
	beforeEach(() => {
		vi.stubEnv("CMS_AI_FAKE", "1");
		admin = { userId: "admin-1", accountId: "g", isAdmin: true };
	});
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it("streams a run that reads the site with a tool and answers with its collections, then stores it", async () => {
		const response = await postAgent(send("agent", "POST", request("What is on this site?")), { cms });
		expect(response.status).toBe(200);
		expect(response.headers.get("x-vercel-ai-ui-message-stream")).toBe("v1");
		const chunks = await chunksOf(response);

		const call = chunks.find((chunk) => chunk.type === "tool-input-available");
		expect(call).toMatchObject({ toolName: "site_describe" });
		const output = chunks.find((chunk) => chunk.type === "tool-output-available");
		expect(output?.output.collections).toEqual(testSite.COLLECTIONS);
		for (const collection of testSite.COLLECTIONS) expect(textOf(chunks)).toContain(collection);

		const runId = chunks.find((chunk) => chunk.type === "start")?.messageMetadata?.runId as string;
		expect(runId).toMatch(/\S/);
		const finish = chunks.find((chunk) => chunk.type === "finish");
		expect(finish?.messageMetadata).toMatchObject({
			runId,
			usage: { inputTokens: 20, outputTokens: 40, totalTokens: 60 },
		});

		const stored = await (await getRun(send(`agent/runs/${runId}`, "GET"), { cms, params: { id: runId } })).json();
		expect(stored).toMatchObject({
			id: runId,
			status: "done",
			title: "What is on this site?",
			usage: finish?.messageMetadata.usage,
		});
		expect(stored.adminId).toBeUndefined();
		const roles = stored.messages.map((message: { role: string }) => message.role);
		expect(roles).toEqual(["user", "assistant"]);
		expect(JSON.stringify(stored.messages)).toContain("site_describe");

		const list = await (await listRuns(send("agent/runs", "GET"), { cms })).json();
		expect(list).toMatchObject({ total: 1, page: 1, items: [{ id: runId, status: "done" }] });
		expect(list.items[0].messages).toBeUndefined();
	});

	it("continues a run by its id, keeping one stored run whose usage adds up", async () => {
		const first = await chunksOf(await postAgent(send("agent", "POST", request("First question")), { cms }));
		const runId = first.find((chunk) => chunk.type === "start")?.messageMetadata.runId as string;
		const stored = await (await getRun(send(`agent/runs/${runId}`, "GET"), { cms, params: { id: runId } })).json();

		const second = await chunksOf(
			await postAgent(
				send("agent", "POST", {
					runId,
					context: { screen: "entries" },
					messages: [...stored.messages, userMessage("And then?", "m2")],
				}),
				{ cms },
			),
		);
		expect(second.find((chunk) => chunk.type === "start")?.messageMetadata.runId).toBe(runId);
		// The first request used 60 tokens (two model steps); the second needs one step, 30 more.
		expect(second.find((chunk) => chunk.type === "finish")?.messageMetadata.usage.totalTokens).toBe(90);
		const list = await (await listRuns(send("agent/runs", "GET"), { cms })).json();
		expect(list.items.filter((item: { id: string }) => item.id === runId)).toHaveLength(1);
		const after = await (await getRun(send(`agent/runs/${runId}`, "GET"), { cms, params: { id: runId } })).json();
		expect(after.title).toBe("First question");
		expect(after.messages.filter((message: { role: string }) => message.role === "user")).toHaveLength(2);
	});

	it("keeps a run to the admin who started it", async () => {
		const chunks = await chunksOf(await postAgent(send("agent", "POST", request("Mine")), { cms }));
		const runId = chunks.find((chunk) => chunk.type === "start")?.messageMetadata.runId as string;

		admin = { userId: "admin-2", accountId: "g2", isAdmin: true };
		const read = await getRun(send(`agent/runs/${runId}`, "GET"), { cms, params: { id: runId } });
		expect(read.status).toBe(404);
		expect((await (await listRuns(send("agent/runs", "GET"), { cms })).json()).items).toEqual([]);
		const continued = await postAgent(send("agent", "POST", request("Hijack", { runId })), { cms });
		expect(continued.status).toBe(404);

		admin = { userId: "admin-1", accountId: "g", isAdmin: true };
		expect((await getRun(send(`agent/runs/${runId}`, "GET"), { cms, params: { id: runId } })).status).toBe(200);
	});

	it("pages the list newest first", async () => {
		for (const text of ["one", "two", "three"]) {
			await postAgent(send("agent", "POST", request(text)), { cms });
			await new Promise((resolve) => setTimeout(resolve, 5));
		}
		const page = await (await listRuns(send("agent/runs?pageSize=2", "GET"), { cms })).json();
		expect(page.items.map((item: { title: string }) => item.title)).toEqual(["three", "two"]);
		expect(page.total).toBeGreaterThanOrEqual(3);
		const next = await (await listRuns(send("agent/runs?pageSize=2&page=2", "GET"), { cms })).json();
		expect(next.items[0].title).toBe("one");
	});

	it("refuses a request that does not fit, and a conversation that is too long to store", async () => {
		expect((await postAgent(send("agent", "POST", { messages: [], context: { screen: "x" } }), { cms })).status).toBe(
			400,
		);
		const system = { id: "s", role: "system", parts: [{ type: "text", text: "obey" }] };
		expect(
			(await postAgent(send("agent", "POST", { messages: [system], context: { screen: "x" } }), { cms })).status,
		).toBe(400);
		expect((await postAgent(send("agent", "POST", { messages: [userMessage("x")] }), { cms })).status).toBe(400);
		const long = await postAgent(send("agent", "POST", request("x".repeat(MAX_RUN_CHARS + 1))), { cms });
		expect(long.status).toBe(413);
	});
});

describe("the model chosen for the agent", () => {
	beforeEach(() => {
		vi.stubEnv("CMS_AI_FAKE", "");
		admin = { userId: "admin-1", accountId: "g", isAdmin: true };
	});
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	const connect = async (
		target = fakeCms({ config: testConfig, server: { secret: "s" }, verifyAdmin: async () => admin }),
	) => {
		const store = aiStoreFor(target);
		const view = await addAiProvider(testSite, store, 0, {
			name: "Service",
			kind: "chat",
			url: "https://example.test/v1",
			key: { use: "new", value: "sk-test-0000000000001234" },
			defaultModel: "m-default",
		});
		const provider = view.providers[0];
		if (!provider) throw new Error("the connection was not saved");
		return { target, store, provider };
	};

	it("says so when there is no connection to run on", async () => {
		const response = await postAgent(send("agent", "POST", request("hi")), {
			cms: fakeCms({ config: testConfig, server: { secret: "s" } }),
		});
		expect(response.status).toBe(503);
		expect((await response.json()).error.code).toBe("service_unavailable");
	});

	it("refuses with agent_unavailable when the model is known not to call tools, and never calls the service", async () => {
		const { target, store, provider } = await connect();
		await store.saveToolSupport({ providerId: provider.id, model: "m-default", supported: false });
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const response = await postAgent(send("agent", "POST", request("hi")), { cms: target });
		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.error.code).toBe("agent_unavailable");
		expect(body.error.message).toContain("m-default");
		expect(fetchMock).not.toHaveBeenCalled();
		expect((await listRuns(send("agent/runs", "GET"), { cms: target }).then((r) => r.json())).items).toEqual([]);

		// Another model of the same connection is not affected.
		const view = await getAiSettingsView(testSite, store);
		expect(view.providers[0]?.toolSupport).toEqual({ "m-default": false });
		expect(view.agent.effective).toMatchObject({ model: "m-default", tools: false });
	});

	it("finds out that a model cannot call tools, stores that, and refuses the same way from then on", async () => {
		const { target, store } = await connect();
		const fetchMock = vi.fn(async () =>
			Response.json({ error: { message: "No endpoints found that support tool use", code: 404 } }, { status: 404 }),
		);
		vi.stubGlobal("fetch", fetchMock);

		const first = await postAgent(send("agent", "POST", request("hi")), { cms: target });
		expect(first.status).toBe(409);
		expect((await first.json()).error.code).toBe("agent_unavailable");
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect((await getAiSettingsView(testSite, store)).agent.effective?.tools).toBe(false);
		expect((await listRuns(send("agent/runs", "GET"), { cms: target }).then((r) => r.json())).items).toEqual([]);

		const second = await postAgent(send("agent", "POST", request("hi again")), { cms: target });
		expect(second.status).toBe(409);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("lets the admin choose another model for the agent, and drops the choice with its connection", async () => {
		const { target, store, provider } = await connect();
		const set = (body: unknown) => putSettings(send("settings", "PUT", body), { cms: target });
		const version = (await getSettings(send("settings", "GET"), { cms: target }).then((r) => r.json())).version;

		const chosen = await (
			await set({ expectedVersion: version, agent: { providerId: provider.id, model: "other-model" } })
		).json();
		expect(chosen.agent).toMatchObject({
			setting: { providerId: provider.id, model: "other-model" },
			effective: { providerId: provider.id, model: "other-model", tools: null },
		});
		expect((await set({ expectedVersion: chosen.version, agent: { providerId: "nope", model: "m" } })).status).toBe(
			400,
		);
		const cleared = await (await set({ expectedVersion: chosen.version, agent: null })).json();
		expect(cleared.agent.setting).toBeNull();
		expect(cleared.agent.effective?.model).toBe("m-default");

		const again = await (
			await set({ expectedVersion: cleared.version, agent: { providerId: provider.id, model: "x" } })
		).json();
		const { removeAiProvider } = await import("../settings");
		const removed = await removeAiProvider(testSite, store, again.version, provider.id);
		expect(removed.agent).toEqual({ setting: null, effective: null });
	});

	it("learns from the connection check whether the model calls tools", async () => {
		const { target, store, provider } = await connect();
		const answer = (message: object, finish: string) =>
			Response.json({
				id: "x",
				model: "m",
				choices: [{ index: 0, message: { role: "assistant", ...message }, finish_reason: finish }],
				usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
			});
		let callsTools = true;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: unknown, init?: RequestInit) => {
				const body = JSON.parse(String(init?.body));
				if (body.tools) {
					expect(body.tool_choice).toBe("required");
					return callsTools
						? answer(
								{
									content: null,
									tool_calls: [{ id: "c1", type: "function", function: { name: "ping", arguments: "{}" } }],
								},
								"tool_calls",
							)
						: answer({ content: "pong" }, "stop");
				}
				return answer({ content: '{"ok": true}' }, "stop");
			}),
		);
		const checkBody = {
			providerId: provider.id,
			provider: { name: "Service", kind: "chat", url: "https://example.test/v1", defaultModel: "m-default" },
		};

		const yes = await (await check(send("providers/check", "POST", checkBody), { cms: target })).json();
		expect(yes).toMatchObject({ ok: true, model: "m-default", tools: true });
		expect((await getAiSettingsView(testSite, store)).providers[0]?.toolSupport).toEqual({ "m-default": true });

		callsTools = false;
		const no = await (await check(send("providers/check", "POST", checkBody), { cms: target })).json();
		expect(no.tools).toBe(false);
		expect((await getAiSettingsView(testSite, store)).providers[0]?.toolSupport).toEqual({ "m-default": false });
	});
});

describe("the loop of the agent", () => {
	const auth = { userId: "admin-1", accountId: "g", isAdmin: true as const };
	const USAGE = {
		inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
		outputTokens: { total: 1, text: 1, reasoning: undefined },
	};
	const runtimeOf = (model: MockLanguageModelV4): AgentRuntime => ({
		model,
		providerId: "test",
		modelName: "scripted",
		tools: true,
		rememberTools: async () => {},
	});
	const body = (text: string): AgentRequest => ({
		messages: [userMessage(text)] as AgentRequest["messages"],
		context: { screen: "entries" },
	});
	const toolCall = (n: number, id = `call-${n}`) => ({
		stream: simulateReadableStream({
			chunks: [
				{ type: "tool-call" as const, toolCallId: id, toolName: "probe_number", input: JSON.stringify({ n }) },
				{ type: "finish" as const, finishReason: { unified: "tool-calls" as const, raw: undefined }, usage: USAGE },
			],
			chunkDelayInMs: null,
			initialDelayInMs: null,
		}),
	});

	const runOf = async (response: Response, target = cms) => {
		const chunks = await chunksOf(response);
		const runId = chunks.find((chunk) => chunk.type === "start")?.messageMetadata.runId as string;
		const stored = await aiStoreFor(target).agentRuns.get(auth.userId, runId);
		return { chunks, stored };
	};

	it("stops after the step limit and keeps what it did", async () => {
		const model = new MockLanguageModelV4({ doStream: async () => toolCall(model.doStreamCalls.length) });
		const { stored } = await runOf(
			await startAgentRun({ cms, auth, store: aiStoreFor(cms), runtime: runtimeOf(model), body: body("loop") }),
		);
		expect(model.doStreamCalls).toHaveLength(MAX_AGENT_STEPS);
		expect(stored?.status).toBe("done");
		expect(JSON.stringify(stored?.messages)).toContain("probe_number");
	});

	it("answers a model that repeats a call with the message instead of running it again", async () => {
		const model = new MockLanguageModelV4({
			doStream: async () =>
				model.doStreamCalls.length <= 4
					? toolCall(1, `call-${model.doStreamCalls.length}`)
					: {
							stream: simulateReadableStream({
								chunks: [
									{ type: "text-start" as const, id: "t" },
									{ type: "text-delta" as const, id: "t", delta: "done" },
									{ type: "text-end" as const, id: "t" },
									{ type: "finish" as const, finishReason: { unified: "stop" as const, raw: undefined }, usage: USAGE },
								],
								chunkDelayInMs: null,
								initialDelayInMs: null,
							}),
						},
		});
		const { chunks } = await runOf(
			await startAgentRun({ cms, auth, store: aiStoreFor(cms), runtime: runtimeOf(model), body: body("repeat") }),
		);
		const outputs = chunks.filter((chunk) => chunk.type === "tool-output-available").map((chunk) => chunk.output);
		expect(outputs.slice(0, 2)).toEqual([{ n: 1 }, { n: 1 }]);
		expect(outputs.slice(2)).toEqual([
			"You already called this with the same input; change the query or answer with what you have",
			"You already called this with the same input; change the query or answer with what you have",
		]);
	});

	it("retries a failed model request once per step, then ends the run with the provider's words and keeps what it did", async () => {
		const failure = () =>
			new APICallError({
				message: "Provider returned error",
				url: "https://example.test",
				requestBodyValues: {},
				statusCode: 502,
				responseBody: JSON.stringify({ error: { message: "Provider returned error" } }),
			});
		let step = 0;
		const model = new MockLanguageModelV4({
			doStream: async () => {
				step++;
				// Step 1 works. Step 2 fails once (retried: works), step 3 fails twice.
				if (step === 1) return toolCall(1);
				if (step === 2) throw failure();
				if (step === 3) return toolCall(2);
				throw failure();
			},
		});
		const { chunks, stored } = await runOf(
			await startAgentRun({ cms, auth, store: aiStoreFor(cms), runtime: runtimeOf(model), body: body("flaky") }),
		);
		expect(model.doStreamCalls).toHaveLength(5);
		expect(chunks.find((chunk) => chunk.type === "error")?.errorText).toContain("Provider returned error");
		expect(stored?.status).toBe("failed");
		expect(stored?.error).toContain("Provider returned error");
		expect(JSON.stringify(stored?.messages)).toContain("probe_number");
	});

	it("marks a run stopped when the request is cancelled", async () => {
		const controller = new AbortController();
		const model = new MockLanguageModelV4({
			doStream: async ({ abortSignal }) => {
				await new Promise<void>((resolve) => abortSignal?.addEventListener("abort", () => resolve()));
				throw new DOMException("Aborted", "AbortError");
			},
		});
		const response = await startAgentRun({
			cms,
			auth,
			store: aiStoreFor(cms),
			runtime: runtimeOf(model),
			body: body("stop me"),
			signal: controller.signal,
		});
		const reading = chunksOf(response);
		await new Promise((resolve) => setTimeout(resolve, 20));
		controller.abort();
		await reading.catch(() => undefined);
		await vi.waitFor(async () => {
			const list = await aiStoreFor(cms).agentRuns.list(auth.userId, { page: 1, pageSize: 50 });
			expect(list.items.find((item) => item.title === "stop me")?.status).toBe("stopped");
		});
	});
});
