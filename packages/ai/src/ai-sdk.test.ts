import type { OpenKey } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
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

async function turn(provider: ReturnType<ReturnType<typeof aiSdkProvider>>, sent: TurnRequest) {
	const events: TurnEvent[] = [];
	for await (const event of provider.turn(sent)) events.push(event);
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
