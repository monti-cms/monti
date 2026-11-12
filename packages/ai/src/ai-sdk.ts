import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { type OpenKey, SERVICE_URLS, withoutRedirects } from "@monti-cms/core";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
	APICallError,
	generateText,
	type JSONSchema7,
	type JSONValue,
	jsonSchema,
	type LanguageModel,
	type ModelMessage,
	Output,
	streamText,
	tool,
} from "ai";
import {
	type ChatMessage,
	type ModelProvider,
	ProviderError,
	type ProviderFor,
	type Thinking,
	type ToolCall,
	type TurnEvent,
	type TurnRequest,
} from "./provider";

type Fetch = typeof globalThis.fetch;

/**
 * The AI SDK's model for a key: the service the key is for, with the key itself. A plugin's service the SDK has no provider for gives none.
 *
 * A key goes to its own service and nowhere else. Each built-in service is called at its one address, given here: the SDK's providers would
 * otherwise take one from the environment (`ANTHROPIC_BASE_URL`, `OPENAI_BASE_URL`), and a stored key would follow it. And no request follows a
 * redirect, which would carry the key's header to wherever the service points.
 */
function languageModel(key: OpenKey, given: Fetch | undefined): ((model: string) => LanguageModel) | null {
	const fetch = withoutRedirects(given ?? globalThis.fetch);
	const at = (baseURL: string) => ({ apiKey: key.secret, baseURL, fetch });
	switch (key.service) {
		case "anthropic":
			return (model) => createAnthropic(at(SERVICE_URLS.anthropic))(model);
		case "openai":
			return (model) => createOpenAI(at(SERVICE_URLS.openai))(model);
		case "gemini":
			return (model) => createGoogleGenerativeAI(at(SERVICE_URLS.gemini))(model);
		case "openrouter":
			return (model) => createOpenRouter(at(SERVICE_URLS.openrouter))(model);
		case "openai-compatible":
			return (model) =>
				createOpenAICompatible({
					name: "compatible",
					baseURL: key.baseUrl ?? "",
					...(key.secret ? { apiKey: key.secret } : {}),
					fetch,
				})(model);
		default:
			return null;
	}
}

/**
 * How much thinking is asked of each service, in its own words. A model that cannot think is asked for nothing. "off" on a model that can think is
 * the least the service takes: several cannot turn thinking off at all (Claude from Sonnet 5.5 and Opus 5.5 on, OpenAI's reasoning models).
 */
function thinkingOptions(
	service: string,
	thinking: Thinking,
	thinks: boolean,
): Record<string, Record<string, JSONValue>> | undefined {
	if (!thinks) return undefined;
	const level = thinking === "off" ? "low" : thinking;
	switch (service) {
		case "anthropic":
			// Adaptive thinking with an effort; "off" leaves thinking to the model's own default at the lowest effort.
			return {
				anthropic: { ...(thinking === "off" ? {} : { thinking: { type: "adaptive" as const } }), effort: level },
			};
		case "openai":
			return { openai: { reasoningEffort: level } };
		case "gemini":
			// Its thoughts come as it thinks, so a long think is seen to be one and not taken for a service gone silent.
			return { google: { thinkingConfig: { thinkingLevel: level, includeThoughts: true } } };
		case "openrouter":
			return { openrouter: { reasoning: { effort: thinking === "off" ? ("none" as const) : level } } };
		default:
			return undefined;
	}
}

/** What the SDK gave for an assistant message, kept to hand back to the same service unchanged (its thinking goes with it). */
type Raw = { service: string; messages: ModelMessage[] };

/** Whether the service's copy of a message calls exactly the tools the stored message does, by the calls' ids. */
function sameCalls(messages: ModelMessage[], calls: ToolCall[]): boolean {
	const theirs = messages.flatMap((message) =>
		message.role === "assistant" && Array.isArray(message.content)
			? message.content.flatMap((part) => (part.type === "tool-call" ? [part.toolCallId] : []))
			: [],
	);
	return theirs.length === calls.length && calls.every((call) => theirs.includes(call.id));
}

/**
 * The parts of the SDK's stream that are the SDK's own and say nothing of the service: a stream that has given only these has not been
 * answered yet. (`TextStreamPart` of `ai` 7: read from its type, `node_modules/ai/dist/index.d.ts`.)
 */
const OWN_PARTS = new Set(["start", "start-step", "finish", "abort", "steering-message"]);

function toSdk(messages: ChatMessage[], service: string): ModelMessage[] {
	return messages.flatMap((message): ModelMessage[] => {
		if (message.role === "user")
			return [
				message.pictures?.length
					? {
							role: "user",
							content: [
								{ type: "text", text: message.text },
								...message.pictures.map((picture) => ({
									type: "image" as const,
									image: picture.base64,
									mediaType: picture.mime,
								})),
							],
						}
					: { role: "user", content: message.text },
			];
		if (message.role === "assistant") {
			const raw = message.raw as Raw | undefined;
			// The service's own copy, unchanged, when it is of this service and holds exactly the calls the message is stored with. A copy
			// with other calls (an answer cut for length, whose calls were dropped) would carry a call nothing answers.
			if (
				raw?.service === service &&
				Array.isArray(raw.messages) &&
				raw.messages.length > 0 &&
				sameCalls(raw.messages, message.calls)
			)
				return raw.messages;
			return [
				{
					role: "assistant",
					content: [
						...(message.text === "" ? [] : [{ type: "text" as const, text: message.text }]),
						...message.calls.map((call) => ({
							type: "tool-call" as const,
							toolCallId: call.id,
							toolName: call.name,
							input: call.input ?? {},
						})),
					],
				},
			];
		}
		return [
			{
				role: "tool",
				content: message.answers.map((answer) => ({
					type: "tool-result" as const,
					toolCallId: answer.id,
					toolName: answer.name,
					output: {
						type: answer.error ? ("error-json" as const) : ("json" as const),
						// The answers were JSON when they were stored.
						value: (answer.output ?? null) as never,
					},
				})),
			},
		];
	});
}

/** A service's failure as the run reports it: it said no (the person can act on that), or it could not be reached. */
function failure(error: unknown): ProviderError {
	if (error instanceof ProviderError) return error;
	if (APICallError.isInstance(error)) {
		const status = error.statusCode;
		// 4xx is the service's answer: the key, the credit, a limit, the model, the request. 408 and 5xx are the service not answering.
		const refused = status !== undefined && status >= 400 && status < 500 && status !== 408;
		return new ProviderError(refused ? "refused" : "unreachable", error.message, status);
	}
	return new ProviderError("unreachable", error instanceof Error ? error.message : String(error));
}

/**
 * The real model services, through the AI SDK's providers (doc 10): Anthropic, OpenAI, Google, OpenRouter and any OpenAI-compatible server, each
 * called with the key the keys screen stored. The SDK gives one request shape for all of them; the loop is the run engine's own, so tools are
 * given without a way to run them and each call here is one turn. `fetch` replaces the network in tests.
 */
export function aiSdkProvider(options: { fetch?: Fetch } = {}): ProviderFor {
	return (key): ModelProvider => {
		const model = languageModel(key, options.fetch);
		const none = () => new ProviderError("refused", `Monti has no model provider for the service "${key.service}".`);
		return {
			async *turn(request: TurnRequest): AsyncGenerator<TurnEvent> {
				if (!model) throw none();
				let began = false;
				try {
					const result = streamText({
						model: model(request.model),
						system: request.system,
						messages: toSdk(request.messages, key.service),
						tools: Object.fromEntries(
							request.tools.map((spec) => [
								spec.name,
								tool({ description: spec.description, inputSchema: jsonSchema(spec.inputSchema as JSONSchema7) }),
							]),
						),
						abortSignal: request.signal,
						// The run engine decides what happens after a failure; one retry covers a dropped connection.
						maxRetries: 1,
						providerOptions: thinkingOptions(key.service, request.thinking, request.thinks),
					});
					let usage = { input: 0, output: 0 };
					let cut: "length" | "refusal" | undefined;
					for await (const part of result.fullStream) {
						if (part.type === "text-delta") {
							began = true;
							yield { type: "text", delta: part.text };
						} else if (part.type === "tool-call")
							yield { type: "call", call: { id: part.toolCallId, name: part.toolName, input: part.input } };
						else if (part.type === "finish-step") {
							usage = { input: part.usage.inputTokens ?? 0, output: part.usage.outputTokens ?? 0 };
							// The stream closed before the service said the answer was whole (a connection cut, a proxy's limit): what came is not
							// an answer. The run engine gives the turn up and can ask for it again. What the service counted for it was spent.
							if (part.finishReason === "interrupted" || part.finishReason === "error")
								throw new ProviderError(
									began ? "interrupted" : "unreachable",
									"The answer ended before it was whole.",
									undefined,
									usage.input + usage.output > 0 ? usage : undefined,
								);
							// The service ended the answer itself: out of room, or it declined to go on.
							cut =
								part.finishReason === "length"
									? "length"
									: part.finishReason === "content-filter"
										? "refusal"
										: undefined;
						} else if (part.type === "error") throw part.error;
						// The service says it thinks, and that it is done: between the two a long silence is a think (OpenAI shows nothing of it).
						else if (part.type === "reasoning-start" || part.type === "reasoning-delta") {
							began = true;
							yield { type: "alive", thinking: true };
						} else if (part.type === "reasoning-end") yield { type: "alive", thinking: false };
						// Anything else the service sends (a tool call's input as it is written, a ping) shows it is there. The SDK's own parts do not.
						else if (!OWN_PARTS.has(part.type)) {
							began = true;
							yield { type: "alive" };
						}
					}
					const raw: Raw = { service: key.service, messages: await result.responseMessages };
					yield { type: "end", usage, raw, ...(cut ? { cut } : {}) };
				} catch (error) {
					const failed = failure(error);
					// The service had begun to answer: what went wrong after that (the stream cut, a last piece that cannot be read) broke the answer
					// off. Before any word it is a service that did not answer.
					throw began && failed.kind === "unreachable"
						? new ProviderError("interrupted", failed.detail, failed.status, failed.usage)
						: failed;
				}
			},
			async answer(request) {
				if (!model) throw none();
				try {
					const result = await generateText({
						model: model(request.model),
						system: request.system,
						messages: toSdk(
							[{ role: "user", text: request.prompt, ...(request.picture ? { pictures: [request.picture] } : {}) }],
							key.service,
						),
						output: Output.object({ schema: jsonSchema(request.schema as JSONSchema7) }),
						...(request.signal ? { abortSignal: request.signal } : {}),
						maxRetries: 1,
					});
					return {
						value: result.output,
						usage: { input: result.usage.inputTokens ?? 0, output: result.usage.outputTokens ?? 0 },
					};
				} catch (error) {
					throw failure(error);
				}
			},
		};
	};
}
