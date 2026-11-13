// The model service of the flow tests (`model.ts` runs it): an OpenAI-compatible server.
//
//   GET  /v1/models             the one model it has
//   POST /v1/chat/completions   one turn, streamed
//
// It has one thing it does, decided from the conversation it is sent (it keeps nothing between requests): asked with entries picked on the
// list, it reads the first picked entry, proposes a summary for it, and says so. `packages/ai` runs the real provider against it
// (`e2e-model.int.test.ts`), so it stays a service the provider can read while the flows themselves run only in CI.
import { createServer } from "node:http";

/** The model's name, and the summary it proposes. The flow test knows both. */
export const MODEL_NAME = "e2e-model";
export const SUMMARY = "가짜 모델이 쓴 요약입니다.";

type Call = { id: string; function: { name: string; arguments: string } };
type Message = {
	role: string;
	content?: string | { type?: string; text?: string }[] | null;
	tool_calls?: Call[];
};

const words = (message: Message | undefined) =>
	typeof message?.content === "string"
		? message.content
		: (message?.content ?? []).map((part) => part.text ?? "").join("");

/** What it does next: words, or one tool call. */
function next(messages: Message[]): { text: string } | { call: { name: string; input: unknown } } {
	const asked = messages.findLastIndex((message) => message.role === "user");
	const since = messages.slice(asked + 1);
	const last = since.flatMap((message) => message.tool_calls ?? []).at(-1);
	if (!last) {
		// The picked rows come with the request, as the screen's context.
		const picked = /"ids":\s*\[\s*"([^"]+)"/.exec(words(messages[asked]))?.[1];
		return picked ? { call: { name: "entries_get", input: { id: picked } } } : { text: "고른 글이 없습니다." };
	}
	if (last.function.name === "entries_get") {
		const { id } = JSON.parse(last.function.arguments) as { id: string };
		// The entry's version, from what the read gave (a JSON text, or one quoted inside another).
		const version = /"version\\?":\s*(\d+)/.exec(words(since.findLast((message) => message.role === "tool")))?.[1];
		return {
			call: {
				name: "entries_save",
				input: { id, version: Number(version ?? 1), values: { summary: SUMMARY }, _group: "요약 채우기" },
			},
		};
	}
	return { text: "요약을 제안했습니다." };
}

/** The service, not yet listening. */
export const modelService = () =>
	createServer((request, response) => {
		const path = `${request.method} ${request.url}`;
		if (path === "GET /v1/models") {
			response.writeHead(200, { "content-type": "application/json" });
			return response.end(JSON.stringify({ object: "list", data: [{ id: MODEL_NAME, object: "model" }] }));
		}
		if (path !== "POST /v1/chat/completions") {
			response.writeHead(request.method === "GET" ? 200 : 404, { "content-type": "application/json" });
			return response.end("{}");
		}
		const chunks: Buffer[] = [];
		request.on("data", (chunk: Buffer) => chunks.push(chunk));
		request.on("end", () => {
			const { messages } = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { messages: Message[] };
			const turn = next(messages);
			const chunk = (delta: unknown, finish: string | null = null, usage?: unknown) => ({
				id: "chatcmpl-e2e",
				object: "chat.completion.chunk",
				created: 1_780_000_000,
				model: MODEL_NAME,
				choices: [{ index: 0, delta, finish_reason: finish }],
				...(usage ? { usage } : {}),
			});
			const usage = { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 };
			const events =
				"text" in turn
					? [chunk({ role: "assistant", content: turn.text }), chunk({}, "stop", usage)]
					: [
							chunk({
								role: "assistant",
								tool_calls: [
									{
										index: 0,
										id: `call_${Date.now().toString(36)}`,
										type: "function",
										function: { name: turn.call.name, arguments: JSON.stringify(turn.call.input) },
									},
								],
							}),
							chunk({}, "tool_calls", usage),
						];
			response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
			for (const event of events) response.write(`data: ${JSON.stringify(event)}\n\n`);
			response.end("data: [DONE]\n\n");
		});
	});
