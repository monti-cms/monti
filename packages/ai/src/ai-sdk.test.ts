import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { OpenKey } from "@monti-cms/core";
import { afterEach, describe, expect, it } from "vitest";
import { aiSdkProvider } from "./ai-sdk";
import { type ChatMessage, ProviderError, type TurnEvent, type TurnRequest } from "./provider";

const KEY: OpenKey = {
	id: "k1",
	service: "anthropic",
	name: "Anthropic 개인",
	secret: "sk-ant-api03-provider-test-a1b2",
	baseUrl: null,
};

/** Anthropic's answer to a streamed Messages request, as the service sends it: some words, then one tool call. */
const STREAM = [
	{
		type: "message_start",
		message: {
			id: "msg_1",
			type: "message",
			role: "assistant",
			model: "claude-sonnet-5-5",
			content: [],
			stop_reason: null,
			stop_sequence: null,
			usage: { input_tokens: 120, output_tokens: 1 },
		},
	},
	{ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
	{ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "찾아" } },
	{ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "볼게요." } },
	{ type: "content_block_stop", index: 0 },
	{
		type: "content_block_start",
		index: 1,
		content_block: { type: "tool_use", id: "toolu_1", name: "entries_query", input: {} },
	},
	{ type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{"collection":' } },
	{ type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '"post"}' } },
	{ type: "content_block_stop", index: 1 },
	{ type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 31 } },
	{ type: "message_stop" },
]
	.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
	.join("");

/** A network that keeps what was sent and answers what the test says. */
function network(answer: () => Response) {
	const sent: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = [];
	const fetch: typeof globalThis.fetch = async (input, init) => {
		sent.push({
			url: String(input),
			headers: Object.fromEntries(new Headers(init?.headers).entries()),
			body: JSON.parse(String(init?.body ?? "{}")),
		});
		return answer();
	};
	return { sent, fetch };
}

const request = (messages: ChatMessage[], more: Partial<TurnRequest> = {}): TurnRequest => ({
	model: "claude-sonnet-5-5",
	system: "You are the assistant.",
	messages,
	tools: [
		{
			name: "entries_query",
			description: "Find entries.",
			inputSchema: { type: "object", properties: { collection: { type: "string" } }, required: ["collection"] },
		},
	],
	thinking: "medium",
	thinks: true,
	signal: new AbortController().signal,
	...more,
});

/** A turn's words, calls and end. The signs of life between them (a tool call's input as it is written) are counted, not listed. */
async function turn(provider: ReturnType<ReturnType<typeof aiSdkProvider>>, sent: TurnRequest) {
	const events: TurnEvent[] = [];
	for await (const event of provider.turn(sent)) if (event.type !== "alive") events.push(event);
	return events;
}

describe("the real provider, on the AI SDK", () => {
	it("10-1 one turn: the key goes to its own service in its header, and the words, the tool call and the tokens come back", async () => {
		const net = network(() => new Response(STREAM, { status: 200, headers: { "content-type": "text/event-stream" } }));
		const provider = aiSdkProvider({ fetch: net.fetch })(KEY);
		const events = await turn(provider, request([{ role: "user", text: "요약이 비어 있는 글 찾아 줘" }]));

		expect(events.slice(0, 3)).toEqual([
			{ type: "text", delta: "찾아" },
			{ type: "text", delta: "볼게요." },
			{ type: "call", call: { id: "toolu_1", name: "entries_query", input: { collection: "post" } } },
		]);
		expect(events[3]).toMatchObject({ type: "end", usage: { input: 120, output: 31 } });

		const [sent] = net.sent;
		expect(sent.url).toBe("https://api.anthropic.com/v1/messages");
		expect(sent.headers["x-api-key"]).toBe(KEY.secret);
		expect(sent.url).not.toContain(KEY.secret);
		expect(sent.body).toMatchObject({
			model: "claude-sonnet-5-5",
			stream: true,
			system: [{ text: "You are the assistant." }],
		});
		// The tool is given by its name and schema, with no way to run it here: the loop is the run engine's.
		expect(sent.body.tools).toMatchObject([{ name: "entries_query", input_schema: { required: ["collection"] } }]);
		// Thinking as the current Claude models take it: adaptive, with an effort, never a token budget.
		expect(sent.body.thinking).toEqual({ type: "adaptive" });
		expect(JSON.stringify(sent.body)).not.toContain("budget_tokens");
		expect(JSON.stringify(sent.body)).toContain('"effort":"medium"');
	});

	it("10-1 what the service gave for a turn is handed back to it unchanged on the next, with the tools' answers", async () => {
		const net = network(() => new Response(STREAM, { status: 200, headers: { "content-type": "text/event-stream" } }));
		const provider = aiSdkProvider({ fetch: net.fetch })(KEY);
		const first: ChatMessage = { role: "user", text: "찾아 줘" };
		const events = await turn(provider, request([first]));
		const end = events.at(-1) as Extract<TurnEvent, { type: "end" }>;
		// What is kept is plain JSON: it goes into the database and comes back.
		const raw = JSON.parse(JSON.stringify(end.raw));

		await turn(
			provider,
			request([
				first,
				{
					role: "assistant",
					text: "찾아볼게요.",
					calls: [{ id: "toolu_1", name: "entries_query", input: { collection: "post" } }],
					raw,
				},
				{
					role: "tools",
					answers: [{ id: "toolu_1", name: "entries_query", output: { rows: [], total: 0 }, error: false }],
				},
			]),
		);
		const messages = net.sent[1].body.messages as {
			role: string;
			content: { type: string; [key: string]: unknown }[];
		}[];
		expect(messages.map((message) => message.role)).toEqual(["user", "assistant", "user"]);
		expect(messages[1].content.map((part) => part.type)).toEqual(["text", "tool_use"]);
		expect(messages[2].content[0]).toMatchObject({ type: "tool_result", tool_use_id: "toolu_1" });
		expect(JSON.stringify(messages[2].content[0])).toContain('\\"total\\":0');
	});

	it('10-1 a model that cannot think is asked for no thinking, and "off" asks a thinking model for the least', async () => {
		const net = network(() => new Response(STREAM, { status: 200, headers: { "content-type": "text/event-stream" } }));
		const provider = aiSdkProvider({ fetch: net.fetch })(KEY);
		await turn(provider, request([{ role: "user", text: "안녕" }], { thinks: false, thinking: "off" }));
		expect(net.sent[0].body.thinking).toBeUndefined();
		expect(JSON.stringify(net.sent[0].body)).not.toContain("effort");
		await turn(provider, request([{ role: "user", text: "안녕" }], { thinks: true, thinking: "off" }));
		expect(net.sent[1].body.thinking).toBeUndefined();
		expect(JSON.stringify(net.sent[1].body)).toContain('"effort":"low"');
	});

	it("10-1 a service that says no (credits) is a refusal with its own words; one that breaks off is not reached", async () => {
		const refusing = network(
			() =>
				new Response(
					JSON.stringify({
						type: "error",
						error: {
							type: "invalid_request_error",
							message: "Your credit balance is too low to access the Anthropic API.",
						},
					}),
					{ status: 400, headers: { "content-type": "application/json" } },
				),
		);
		const refused = await turn(
			aiSdkProvider({ fetch: refusing.fetch })(KEY),
			request([{ role: "user", text: "안녕" }]),
		).catch((error: unknown) => error);
		expect(refused).toBeInstanceOf(ProviderError);
		expect(refused).toMatchObject({ kind: "refused", status: 400 });
		expect((refused as ProviderError).detail).toContain("credit balance is too low");
		expect((refused as ProviderError).message).not.toContain(KEY.secret);

		const down: typeof globalThis.fetch = async () => {
			throw new TypeError("fetch failed");
		};
		const unreachable = await turn(
			aiSdkProvider({ fetch: down })(KEY),
			request([{ role: "user", text: "안녕" }]),
		).catch((error: unknown) => error);
		expect(unreachable).toMatchObject({ kind: "unreachable" });
	});

	it("10-1 a key of a service the SDK has no provider for is a refusal that says so, and nothing is sent", async () => {
		const net = network(() => new Response("{}", { status: 200 }));
		const provider = aiSdkProvider({ fetch: net.fetch })({ ...KEY, service: "bareun" });
		const failed = await turn(provider, request([{ role: "user", text: "안녕" }])).catch((error: unknown) => error);
		expect(failed).toMatchObject({ kind: "refused" });
		expect(net.sent).toEqual([]);
	});

	it("10-1 each service is called at its own address with the key where that service reads it", async () => {
		const seen: Record<string, { url: string; auth: string | undefined }> = {};
		for (const [service, baseUrl] of [
			["openai", null],
			["openrouter", null],
			["gemini", null],
			["openai-compatible", "http://localhost:11434/v1"],
		] as const) {
			const net = network(() => new Response(JSON.stringify({ error: { message: "no" } }), { status: 401 }));
			await turn(
				aiSdkProvider({ fetch: net.fetch })({ ...KEY, service, baseUrl }),
				request([{ role: "user", text: "안녕" }], { model: "a-model" }),
			).catch(() => {});
			const [sent] = net.sent;
			seen[service] = { url: sent.url, auth: sent.headers.authorization ?? sent.headers["x-goog-api-key"] };
			expect(sent.url).not.toContain(KEY.secret);
		}
		expect(new URL(seen.openai.url).host).toBe("api.openai.com");
		expect(new URL(seen.openrouter.url).host).toBe("openrouter.ai");
		expect(new URL(seen.gemini.url).host).toBe("generativelanguage.googleapis.com");
		expect(seen["openai-compatible"].url).toBe("http://localhost:11434/v1/chat/completions");
		expect(seen.openai.auth).toBe(`Bearer ${KEY.secret}`);
		expect(seen.openrouter.auth).toBe(`Bearer ${KEY.secret}`);
		expect(seen.gemini.auth).toBe(KEY.secret);
		expect(seen["openai-compatible"].auth).toBe(`Bearer ${KEY.secret}`);
	});
});

const sse = (events: unknown[], done = false) =>
	`${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")}${done ? "data: [DONE]\n\n" : ""}`;
const streamed = (body: string) =>
	new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
const WORDS = [
	{ type: "text", delta: "찾아" },
	{ type: "text", delta: "볼게요." },
];
const CALL = { type: "call", call: { name: "entries_query", input: { collection: "post" } } };

/** A chat completions stream, as OpenRouter and OpenAI-compatible servers send it: words, one tool call, the tokens, `[DONE]`. */
const chunk = (delta: unknown, finish: string | null = null, usage?: unknown) => ({
	id: "chatcmpl-1",
	object: "chat.completion.chunk",
	created: 1_780_000_000,
	model: "a-model",
	choices: [{ index: 0, delta, finish_reason: finish }],
	...(usage ? { usage } : {}),
});
const COMPLETIONS = sse(
	[
		chunk({ role: "assistant", content: "찾아" }),
		chunk({ content: "볼게요." }),
		chunk({
			tool_calls: [
				{
					index: 0,
					id: "call_1",
					type: "function",
					function: { name: "entries_query", arguments: '{"collection":"post"}' },
				},
			],
		}),
		chunk({}, "tool_calls", { prompt_tokens: 120, completion_tokens: 31, total_tokens: 151 }),
	],
	true,
);

/** OpenAI's Responses stream: the events of one message of words and one function call. */
const RESPONSES = sse([
	{
		type: "response.created",
		response: { id: "resp_1", created_at: 1_780_000_000, model: "gpt-5", service_tier: null },
	},
	{ type: "response.output_item.added", output_index: 0, item: { type: "message", id: "msg_1" } },
	{ type: "response.output_text.delta", item_id: "msg_1", delta: "찾아" },
	{ type: "response.output_text.delta", item_id: "msg_1", delta: "볼게요." },
	{ type: "response.output_item.done", output_index: 0, item: { type: "message", id: "msg_1" } },
	{
		type: "response.output_item.added",
		output_index: 1,
		item: { type: "function_call", id: "fc_1", call_id: "call_1", name: "entries_query", arguments: "" },
	},
	{ type: "response.function_call_arguments.delta", item_id: "fc_1", output_index: 1, delta: '{"collection":"post"}' },
	{
		type: "response.output_item.done",
		output_index: 1,
		item: {
			type: "function_call",
			id: "fc_1",
			call_id: "call_1",
			name: "entries_query",
			arguments: '{"collection":"post"}',
			status: "completed",
		},
	},
	{
		type: "response.completed",
		response: {
			incomplete_details: null,
			usage: {
				input_tokens: 120,
				input_tokens_details: { cached_tokens: 0 },
				output_tokens: 31,
				output_tokens_details: { reasoning_tokens: 0 },
			},
		},
	},
]);

/** Google's stream of a generateContent call: parts of words, then a function call with the tokens. */
const GEMINI = sse([
	{ candidates: [{ content: { role: "model", parts: [{ text: "찾아" }] }, index: 0 }] },
	{ candidates: [{ content: { role: "model", parts: [{ text: "볼게요." }] }, index: 0 }] },
	{
		candidates: [
			{
				content: { role: "model", parts: [{ functionCall: { name: "entries_query", args: { collection: "post" } } }] },
				finishReason: "STOP",
				index: 0,
			},
		],
		usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 31, totalTokenCount: 151 },
	},
]);

describe("each service's own answer is read (review 1 of #472: the shapes, not only Anthropic's)", () => {
	for (const [service, baseUrl, body, path] of [
		["openai", null, RESPONSES, "https://api.openai.com/v1/responses"],
		["openrouter", null, COMPLETIONS, "https://openrouter.ai/api/v1/chat/completions"],
		[
			"gemini",
			null,
			GEMINI,
			"https://generativelanguage.googleapis.com/v1beta/models/a-model:streamGenerateContent?alt=sse",
		],
		["openai-compatible", "http://localhost:11434/v1", COMPLETIONS, "http://localhost:11434/v1/chat/completions"],
	] as const)
		it(`10-1 ${service}: the words, the tool call and the tokens of one turn come back, from the service's own address`, async () => {
			const net = network(() => streamed(body));
			const events = await turn(
				aiSdkProvider({ fetch: net.fetch })({ ...KEY, service, baseUrl }),
				request([{ role: "user", text: "요약이 비어 있는 글 찾아 줘" }], { model: "a-model", thinks: false }),
			);
			expect(events.slice(0, 2)).toEqual(WORDS);
			expect(events[2]).toMatchObject(CALL);
			expect(events[3]).toMatchObject({ type: "end", usage: { input: 120, output: 31 } });
			expect(events[3]).not.toHaveProperty("cut");
			expect(net.sent).toHaveLength(1);
			expect(net.sent[0].url).toBe(path);
			// The tool went by its name and schema, in the service's own words for it.
			expect(JSON.stringify(net.sent[0].body)).toContain("entries_query");
		});
});

describe("a key goes to its own service and nowhere else (review 1 of #472)", () => {
	const kept = { anthropic: process.env.ANTHROPIC_BASE_URL, openai: process.env.OPENAI_BASE_URL };
	afterEach(() => {
		for (const [name, value] of [
			["ANTHROPIC_BASE_URL", kept.anthropic],
			["OPENAI_BASE_URL", kept.openai],
		] as const)
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
	});

	it("10-1 an address in the server's environment does not move a stored key: each built-in service is called at its one address", async () => {
		process.env.ANTHROPIC_BASE_URL = "https://other-service.example/v1";
		process.env.OPENAI_BASE_URL = "https://other-service.example/v1";
		const hosts: Record<string, string> = {};
		for (const service of ["anthropic", "openai", "openrouter", "gemini"] as const) {
			const net = network(() => new Response(JSON.stringify({ error: { message: "no" } }), { status: 401 }));
			await turn(
				aiSdkProvider({ fetch: net.fetch })({ ...KEY, service }),
				request([{ role: "user", text: "안녕" }], { model: "a-model" }),
			).catch(() => {});
			expect(net.sent).toHaveLength(1);
			hosts[service] = new URL(net.sent[0].url).host;
		}
		expect(hosts).toEqual({
			anthropic: "api.anthropic.com",
			openai: "api.openai.com",
			openrouter: "openrouter.ai",
			gemini: "generativelanguage.googleapis.com",
		});
	});

	it("10-1 a redirect is not followed: the key's header never reaches where the service points", async () => {
		// Two real servers and the real fetch: the first answers every request with a redirect to the second.
		const reached: Record<string, string | string[] | undefined>[] = [];
		const second = createServer((incoming, answer) => {
			reached.push(incoming.headers);
			answer.writeHead(200, { "content-type": "application/json" }).end("{}");
		});
		await new Promise<void>((resolve) => second.listen(0, "127.0.0.1", resolve));
		const elsewhere = `http://127.0.0.1:${(second.address() as AddressInfo).port}`;
		let asked = 0;
		const first = createServer((_incoming, answer) => {
			asked += 1;
			answer.writeHead(307, { location: `${elsewhere}/v1/chat/completions` }).end();
		});
		await new Promise<void>((resolve) => first.listen(0, "127.0.0.1", resolve));
		const baseUrl = `http://127.0.0.1:${(first.address() as AddressInfo).port}/v1`;
		try {
			// Every request init the SDK may send is asked with redirects refused, also when the SDK retries.
			const failed = await turn(
				aiSdkProvider()({ ...KEY, service: "openai-compatible", baseUrl }),
				request([{ role: "user", text: "안녕" }], { model: "a-model" }),
			).catch((error: unknown) => error);
			expect(failed).toBeInstanceOf(ProviderError);
			expect(asked).toBeGreaterThan(0);
			expect(reached).toEqual([]);

			// A quick task's one call is the same.
			const answered = await aiSdkProvider()({ ...KEY, service: "openai-compatible", baseUrl })
				.answer({
					model: "a-model",
					system: "s",
					prompt: "p",
					schema: { type: "object", properties: { value: { type: "string" } } },
				})
				.catch((error: unknown) => error);
			expect(answered).toBeInstanceOf(ProviderError);
			expect(reached).toEqual([]);
		} finally {
			await new Promise((resolve) => first.close(resolve));
			await new Promise((resolve) => second.close(resolve));
		}
	});
});

describe("an answer that does not end as the service ends one (review 1 of #472)", () => {
	it("10-4 a stream that closes after some words, without the service's ending, is an answer that broke off, not a whole one", async () => {
		// Anthropic's stream up to its first words, then the connection closes: no message_delta, no message_stop.
		const half = STREAM.slice(0, STREAM.indexOf("event: content_block_stop"));
		const net = network(() => streamed(half));
		const events: TurnEvent[] = [];
		const failed = await (async () => {
			for await (const event of aiSdkProvider({ fetch: net.fetch })(KEY).turn(
				request([{ role: "user", text: "안녕" }]),
			))
				events.push(event);
		})().catch((error: unknown) => error);
		// The words that came were shown as they came; the turn then ends as broken off, with no end event.
		expect(events.filter((event) => event.type === "text")).toEqual(WORDS);
		expect(events.some((event) => event.type === "end")).toBe(false);
		expect(failed).toBeInstanceOf(ProviderError);
		expect(failed).toMatchObject({ kind: "interrupted" });

		// The same for a chat completions stream that stops before its finish reason and `[DONE]`.
		const cut = network(() => streamed(sse([chunk({ role: "assistant", content: "찾아" })])));
		const broken = await turn(
			aiSdkProvider({ fetch: cut.fetch })({
				...KEY,
				service: "openai-compatible",
				baseUrl: "http://localhost:11434/v1",
			}),
			request([{ role: "user", text: "안녕" }], { model: "a-model", thinks: false }),
		).catch((error: unknown) => error);
		expect(broken).toMatchObject({ kind: "interrupted" });
	});

	it("10-1 while a tool call's input is being written the service is seen to be there, though there is nothing to show", async () => {
		const net = network(() => streamed(STREAM));
		const events: TurnEvent[] = [];
		for await (const event of aiSdkProvider({ fetch: net.fetch })(KEY).turn(request([{ role: "user", text: "안녕" }])))
			events.push(event);
		const call = events.findIndex((event) => event.type === "call");
		const lastWords = events.map((event) => event.type).lastIndexOf("text");
		expect(events.slice(lastWords + 1, call).some((event) => event.type === "alive")).toBe(true);
	});
});
