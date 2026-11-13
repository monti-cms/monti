import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { OpenKey } from "@monti-cms/core";
import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("what the second review found in the adapters (#472)", () => {
	it("10-1 the service's own copy of a message is handed back only when it holds the calls the message is stored with", async () => {
		const net = network(() => streamed(STREAM));
		// A message stored after a cut: its words, no calls; the copy the service gave still holds the call.
		const cut: ChatMessage = {
			role: "assistant",
			text: "길어서 여기까지",
			calls: [],
			raw: {
				service: "anthropic",
				messages: [
					{
						role: "assistant",
						content: [
							{ type: "text", text: "길어서 여기까지" },
							{ type: "tool-call", toolCallId: "toolu_cut", toolName: "entries_query", input: {} },
						],
					},
				],
			},
		};
		await turn(
			aiSdkProvider({ fetch: net.fetch })(KEY),
			request([{ role: "user", text: "길게 써 줘" }, cut, { role: "user", text: "계속해 줘" }]),
		);
		const sent = JSON.stringify(net.sent[0].body.messages);
		expect(sent).toContain("길어서 여기까지");
		expect(sent).not.toContain("tool_use");
		expect(sent).not.toContain("toolu_cut");
	});

	it("10-4 a service that has sent nothing is not taken for one that began to answer: the SDK's own first parts are no sign of life", async () => {
		// The answer's headers come, and then nothing: the body stays open and empty.
		const net = network(
			() =>
				new Response(new ReadableStream({ start() {} }), {
					status: 200,
					headers: { "content-type": "text/event-stream" },
				}),
		);
		const gone = new AbortController();
		const events: TurnEvent[] = [];
		const reading = (async () => {
			for await (const event of aiSdkProvider({ fetch: net.fetch })(KEY).turn(
				request([{ role: "user", text: "안녕" }], { signal: gone.signal }),
			))
				events.push(event);
		})().catch(() => {});
		await new Promise((resolve) => setTimeout(resolve, 150));
		expect(net.sent).toHaveLength(1);
		expect(events).toEqual([]);
		gone.abort();
		await reading;
	});

	it("10-4 a model's thinking is seen as it begins and as it ends, and Google is asked to show its thoughts", async () => {
		// Anthropic's stream with a thinking block before the words.
		const thinking = [
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
			{ type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } },
			{ type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "먼저 목록을" } },
			{ type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "sig" } },
			{ type: "content_block_stop", index: 0 },
			{ type: "content_block_start", index: 1, content_block: { type: "text", text: "" } },
			{ type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "찾아볼게요." } },
			{ type: "content_block_stop", index: 1 },
			{ type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 31 } },
			{ type: "message_stop" },
		]
			.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
			.join("");
		const net = network(() => streamed(thinking));
		const events: TurnEvent[] = [];
		for await (const event of aiSdkProvider({ fetch: net.fetch })(KEY).turn(request([{ role: "user", text: "안녕" }])))
			events.push(event);
		const signs = events.flatMap((event) =>
			event.type === "alive" && event.thinking !== undefined ? [event.thinking] : [],
		);
		expect(signs[0]).toBe(true);
		expect(signs.at(-1)).toBe(false);
		// The thinking ended before the words came.
		const done = events.findIndex((event) => event.type === "alive" && event.thinking === false);
		expect(done).toBeLessThan(events.findIndex((event) => event.type === "text"));

		const google = network(() => streamed(GEMINI));
		await turn(
			aiSdkProvider({ fetch: google.fetch })({ ...KEY, service: "gemini" }),
			request([{ role: "user", text: "안녕" }], { model: "a-model", thinks: true }),
		);
		expect(google.sent[0].body.generationConfig).toMatchObject({ thinkingConfig: { includeThoughts: true } });
	});
});

describe("what the first trial against a real service showed (T161)", () => {
	const limited = () =>
		new Response(
			JSON.stringify({
				type: "error",
				error: { type: "rate_limit_error", message: "This model is temporarily rate-limited upstream." },
			}),
			{ status: 429, headers: { "content-type": "application/json" } },
		);

	it("10-1 a limit the service names is a refusal in its words, also after the SDK tried again and gave up: not a service that could not be reached", async () => {
		const net = network(limited);
		const refused = await turn(
			aiSdkProvider({ fetch: net.fetch })(KEY),
			request([{ role: "user", text: "안녕" }]),
		).catch((error: unknown) => error);
		// Asked, and asked once more.
		expect(net.sent).toHaveLength(2);
		expect(refused).toBeInstanceOf(ProviderError);
		expect(refused).toMatchObject({ kind: "refused", status: 429 });
		expect((refused as ProviderError).detail).toBe("This model is temporarily rate-limited upstream.");
		// The quick tasks' one call is read the same way.
		const answered = await aiSdkProvider({ fetch: network(limited).fetch })(KEY)
			.answer({ model: "claude-haiku-5-5", system: "Fill a field.", prompt: "요약", schema: { type: "object" } })
			.catch((error: unknown) => error);
		expect(answered).toMatchObject({ kind: "refused", status: 429 });
		expect((answered as ProviderError).detail).not.toContain("Failed after");
	});

	it("10-1 a call that fails prints nothing on the server: not the request, not the answer's headers", async () => {
		const printed = vi.spyOn(console, "error").mockImplementation(() => {});
		const logged = vi.spyOn(console, "log").mockImplementation(() => {});
		const warned = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const refusing = () =>
				new Response(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "No." } }), {
					status: 400,
					headers: { "content-type": "application/json", "set-cookie": "session=abc" },
				});
			const provider = aiSdkProvider({ fetch: network(refusing).fetch })(KEY);
			await turn(provider, request([{ role: "user", text: "비밀스러운 대화" }])).catch(() => {});
			await provider
				.answer({ model: "claude-haiku-5-5", system: "Fill a field.", prompt: "요약", schema: { type: "object" } })
				.catch(() => {});
			expect(printed).not.toHaveBeenCalled();
			expect(logged).not.toHaveBeenCalled();
			expect(warned).not.toHaveBeenCalled();
		} finally {
			printed.mockRestore();
			logged.mockRestore();
			warned.mockRestore();
		}
	});

	const TOOLS = [
		{ name: "zeta_read", description: "Read.", inputSchema: { type: "object", properties: {} } },
		{ name: "alpha_read", description: "Read.", inputSchema: { type: "object", properties: {} } },
	];
	const refusing = () => new Response(JSON.stringify({ error: { message: "No." } }), { status: 400 });

	it("10-1 a turn for one of Anthropic's models asks its service to keep the tool list and the system prompt, and the tools go in the engine's order", async () => {
		const net = network(() => new Response(STREAM, { status: 200, headers: { "content-type": "text/event-stream" } }));
		await turn(aiSdkProvider({ fetch: net.fetch })(KEY), request([{ role: "user", text: "안녕" }], { tools: TOOLS }));
		const body = net.sent[0]?.body as {
			cache_control?: unknown;
			system: { text: string; cache_control?: unknown }[];
			tools: { name: string; cache_control?: unknown }[];
		};
		expect(body.system.at(-1)).toMatchObject({ text: "You are the assistant.", cache_control: { type: "ephemeral" } });
		// As the engine gave them, not by name: what is cached is the head of the request as it was sent.
		expect(body.tools.map((each) => each.name)).toEqual(["zeta_read", "alpha_read"]);
		expect(body.tools.at(-1)?.cache_control).toEqual({ type: "ephemeral" });
		expect(body.tools[0]?.cache_control).toBeUndefined();
		// And the request as a whole: the mark moves to the end of the conversation as it grows.
		expect(body.cache_control).toEqual({ type: "ephemeral" });
	});

	it("10-1 through OpenRouter the same is asked for Anthropic's models only; the others, and OpenAI, cache by themselves and get no mark", async () => {
		const router: OpenKey = { ...KEY, service: "openrouter", secret: "sk-or-v1-provider-test-a1b2" };
		const ask = async (key: OpenKey, model: string) => {
			const net = network(refusing);
			await turn(
				aiSdkProvider({ fetch: net.fetch })(key),
				request([{ role: "user", text: "안녕" }], { model, tools: TOOLS }),
			).catch(() => {});
			return JSON.stringify(net.sent[0]?.body);
		};
		const claude = await ask(router, "anthropic/claude-sonnet-5.5");
		expect(JSON.parse(claude).cache_control).toEqual({ type: "ephemeral" });
		expect(JSON.parse(claude).messages[0]).toMatchObject({ role: "system" });
		expect(JSON.stringify(JSON.parse(claude).messages[0])).toContain('"cache_control":{"type":"ephemeral"}');
		expect(await ask(router, "google/gemma-4-31b-it:free")).not.toContain("cache_control");
		expect(await ask({ ...KEY, service: "openai", secret: "sk-proj-provider-test-77de" }, "gpt-5.5")).not.toContain(
			"cache",
		);
	});

	it("10-1 what the service read from what it had kept is told beside the whole input, which stays the whole", async () => {
		const kept = STREAM.replace(
			'"usage":{"input_tokens":120,"output_tokens":1}',
			'"usage":{"input_tokens":20,"cache_read_input_tokens":100,"cache_creation_input_tokens":0,"output_tokens":1}',
		);
		expect(kept).not.toBe(STREAM);
		const net = network(() => new Response(kept, { status: 200, headers: { "content-type": "text/event-stream" } }));
		const events = await turn(aiSdkProvider({ fetch: net.fetch })(KEY), request([{ role: "user", text: "안녕" }]));
		expect(events.at(-1)).toMatchObject({ type: "end", usage: { input: 120, output: 31, cached: 100 } });
	});

	it("10-1 an answer cut off before its end (the person stopped it, the request went away) keeps what Anthropic said it took in at the start", async () => {
		// Anthropic tells the input in its first event and the output only with its last: the cut turn's input was spent all the same.
		const head = STREAM.split("\n\n")
			.filter((event) => /message_start|"index":0/.test(event))
			.slice(0, 3)
			.map((event) =>
				event.replace(
					'"usage":{"input_tokens":120,"output_tokens":1}',
					'"usage":{"input_tokens":4,"cache_read_input_tokens":43000,"cache_creation_input_tokens":90,"output_tokens":1}',
				),
			)
			.join("\n\n");
		expect(head).toContain("43000");
		const control = new AbortController();
		const fetch: typeof globalThis.fetch = async (_input, init) =>
			new Response(
				new ReadableStream<Uint8Array>({
					start(stream) {
						stream.enqueue(new TextEncoder().encode(`${head}\n\n`));
						// The rest never comes: the stream ends only when the call is ended.
						init?.signal?.addEventListener("abort", () => stream.error(new DOMException("aborted", "AbortError")));
					},
				}),
				{ status: 200, headers: { "content-type": "text/event-stream" } },
			);
		const said: TurnEvent[] = [];
		const cut = await (async () => {
			for await (const event of aiSdkProvider({ fetch })(KEY).turn(
				request([{ role: "user", text: "안녕" }], { signal: control.signal }),
			)) {
				said.push(event);
				if (event.type === "text") control.abort();
			}
		})().catch((error: unknown) => error);
		expect(said.filter((event) => event.type === "text")).toHaveLength(1);
		expect(cut).toBeInstanceOf(ProviderError);
		expect((cut as ProviderError).usage).toEqual({ input: 43094, output: 1, cached: 43000 });
	});

	it("10-1 the same on Google, whose every chunk says what it counted so far", async () => {
		const chunk = {
			candidates: [{ content: { role: "model", parts: [{ text: "옛날 " }] }, index: 0 }],
			usageMetadata: {
				promptTokenCount: 30_373,
				cachedContentTokenCount: 28_341,
				candidatesTokenCount: 3,
				thoughtsTokenCount: 120,
			},
		};
		const control = new AbortController();
		const fetch: typeof globalThis.fetch = async (_input, init) =>
			new Response(
				new ReadableStream<Uint8Array>({
					start(stream) {
						stream.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\r\n\r\n`));
						init?.signal?.addEventListener("abort", () => stream.error(new DOMException("aborted", "AbortError")));
					},
				}),
				{ status: 200, headers: { "content-type": "text/event-stream" } },
			);
		const cut = await (async () => {
			for await (const event of aiSdkProvider({ fetch })({
				...KEY,
				service: "gemini",
				secret: "AIza-provider-test",
			}).turn(request([{ role: "user", text: "안녕" }], { model: "gemini-3.1-flash-lite", signal: control.signal })))
				if (event.type === "text") control.abort();
		})().catch((error: unknown) => error);
		expect(cut).toBeInstanceOf(ProviderError);
		expect((cut as ProviderError).usage).toEqual({ input: 30_373, output: 123, cached: 28_341 });
	});

	it("10-1 an OpenAI-compatible server is asked to say what a streamed answer spent, and what it says is the turn's usage", async () => {
		// Unasked, Google's compatible address said nothing, and every turn counted as none.
		const chunks = [
			{
				id: "c1",
				object: "chat.completion.chunk",
				choices: [{ index: 0, delta: { role: "assistant", content: "ok" } }],
			},
			{ id: "c1", object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
			{
				id: "c1",
				object: "chat.completion.chunk",
				choices: [],
				usage: {
					prompt_tokens: 30_000,
					completion_tokens: 4,
					total_tokens: 30_004,
					prompt_tokens_details: { cached_tokens: 28_000 },
				},
			},
		];
		const net = network(
			() =>
				new Response(`${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`, {
					status: 200,
					headers: { "content-type": "text/event-stream" },
				}),
		);
		const compatible: OpenKey = {
			...KEY,
			service: "openai-compatible",
			secret: "",
			baseUrl: "https://compatible.example/v1",
		};
		const events = await turn(
			aiSdkProvider({ fetch: net.fetch })(compatible),
			request([{ role: "user", text: "안녕" }], { model: "some-model", thinks: false }),
		);
		expect(net.sent[0]?.body).toMatchObject({ stream: true, stream_options: { include_usage: true } });
		expect(events.at(-1)).toMatchObject({ type: "end", usage: { input: 30_000, output: 4, cached: 28_000 } });
	});

	it("10-1 a compatible server that says what it counted with every chunk: an answer cut off keeps that", async () => {
		const chunk = {
			id: "c1",
			object: "chat.completion.chunk",
			choices: [{ index: 0, delta: { role: "assistant", content: "옛날 " } }],
			usage: { prompt_tokens: 32_956, completion_tokens: 3, total_tokens: 32_959 },
		};
		const control = new AbortController();
		const fetch: typeof globalThis.fetch = async (_input, init) =>
			new Response(
				new ReadableStream<Uint8Array>({
					start(stream) {
						stream.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
						init?.signal?.addEventListener("abort", () => stream.error(new DOMException("aborted", "AbortError")));
					},
				}),
				{ status: 200, headers: { "content-type": "text/event-stream" } },
			);
		const compatible: OpenKey = {
			...KEY,
			service: "openai-compatible",
			secret: "",
			baseUrl: "https://compatible.example/v1",
		};
		const cut = await (async () => {
			for await (const event of aiSdkProvider({ fetch })(compatible).turn(
				request([{ role: "user", text: "안녕" }], { model: "some-model", thinks: false, signal: control.signal }),
			))
				if (event.type === "text") control.abort();
		})().catch((error: unknown) => error);
		expect(cut).toBeInstanceOf(ProviderError);
		expect((cut as ProviderError).usage).toEqual({ input: 32_956, output: 3 });
	});
});
