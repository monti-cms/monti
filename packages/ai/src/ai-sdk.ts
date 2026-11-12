import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { OpenKey } from "@monti-cms/core";
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
	type TurnEvent,
	type TurnRequest,
} from "./provider";

type Fetch = typeof globalThis.fetch;

/** The AI SDK's model for a key: the service the key is for, with the key itself. A plugin's service the SDK has no provider for gives none. */
function languageModel(key: OpenKey, fetch: Fetch | undefined): ((model: string) => LanguageModel) | null {
	const shared = { apiKey: key.secret, ...(fetch ? { fetch } : {}) };
	switch (key.service) {
		case "anthropic":
			return (model) => createAnthropic(shared)(model);
		case "openai":
			return (model) => createOpenAI(shared)(model);
		case "gemini":
			return (model) => createGoogleGenerativeAI(shared)(model);
		case "openrouter":
			return (model) => createOpenRouter(shared)(model);
		case "openai-compatible":
			return (model) =>
				createOpenAICompatible({
					name: "compatible",
					baseURL: key.baseUrl ?? "",
					...(key.secret ? { apiKey: key.secret } : {}),
					...(fetch ? { fetch } : {}),
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
			return { google: { thinkingConfig: { thinkingLevel: level } } };
		case "openrouter":
			return { openrouter: { reasoning: { effort: thinking === "off" ? ("none" as const) : level } } };
		default:
			return undefined;
	}
}

/** What the SDK gave for an assistant message, kept to hand back to the same service unchanged (its thinking goes with it). */
type Raw = { service: string; messages: ModelMessage[] };

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
			if (raw?.service === service && Array.isArray(raw.messages) && raw.messages.length > 0) return raw.messages;
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
						if (part.type === "text-delta") yield { type: "text", delta: part.text };
						else if (part.type === "tool-call")
							yield { type: "call", call: { id: part.toolCallId, name: part.toolName, input: part.input } };
						else if (part.type === "finish-step") {
							usage = { input: part.usage.inputTokens ?? 0, output: part.usage.outputTokens ?? 0 };
							// The service ended the answer itself: out of room, or it declined to go on.
							cut =
								part.finishReason === "length"
									? "length"
									: part.finishReason === "content-filter"
										? "refusal"
										: undefined;
						} else if (part.type === "error") throw part.error;
					}
					const raw: Raw = { service: key.service, messages: await result.responseMessages };
					yield { type: "end", usage, raw, ...(cut ? { cut } : {}) };
				} catch (error) {
					throw failure(error);
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
