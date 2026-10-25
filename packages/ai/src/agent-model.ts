import { APICallError, type LanguageModel, wrapLanguageModel } from "ai";
import { isToolsUnsupportedError } from "./provider";

/** What tells a failed model request that is worth one more try: the service had a problem, not the request. */
export function isTransientModelError(error: unknown): boolean {
	if (APICallError.isInstance(error)) return (error.statusCode ?? 0) >= 500 || error.isRetryable === true;
	const text = error instanceof Error ? error.message : JSON.stringify(error ?? "");
	return /provider returned error|overloaded|temporarily unavailable/i.test(text);
}

/** The chunks a stream sends before any answer: only once one of the others arrives is the request known to have worked. */
/** A chunk of a model stream, as far as this file reads it. */
interface Chunk {
	type: string;
	error?: unknown;
}

const PREAMBLE = new Set<string>(["stream-start", "response-metadata", "raw"]);

/**
 * Reads a model stream up to its first real chunk. An `error` chunk there is the request failing (providers send "Provider returned error" this way), so it
 * is thrown like a failed request; anything else is passed on together with the chunks read so far.
 */
async function startOf<T extends Chunk>(stream: ReadableStream<T>): Promise<ReadableStream<T>> {
	const reader = stream.getReader();
	const buffered: T[] = [];
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		if (value.type === "error") {
			reader.cancel().catch(() => undefined);
			throw value.error;
		}
		buffered.push(value);
		if (!PREAMBLE.has(value.type)) break;
	}
	return new ReadableStream<T>({
		start(controller) {
			for (const chunk of buffered) controller.enqueue(chunk);
		},
		async pull(controller) {
			const { done, value } = await reader.read();
			if (done) controller.close();
			else controller.enqueue(value);
		},
		cancel: (reason) => reader.cancel(reason),
	});
}

export interface AgentModelHooks {
	/** The service said the model cannot call tools. The request is not tried again. */
	onToolsUnsupported(): void;
}

/**
 * The model with one retry for each request of the loop (a step): when the request fails with a service problem, or the service's first chunk is an error, the
 * step is asked once more. A second failure goes on to the run, which ends with the provider's words and keeps what it already did.
 */
export function withAgentRetry(model: LanguageModel, hooks: AgentModelHooks): LanguageModel {
	return wrapLanguageModel({
		model: model as Parameters<typeof wrapLanguageModel>[0]["model"],
		middleware: {
			specificationVersion: "v4",
			wrapStream: async ({ doStream }) => {
				for (let attempt = 0; ; attempt++) {
					try {
						const { stream, ...rest } = await doStream();
						return { ...rest, stream: await startOf(stream) };
					} catch (error) {
						if (isToolsUnsupportedError(error)) hooks.onToolsUnsupported();
						if (attempt >= 1 || !isTransientModelError(error)) throw error;
					}
				}
			},
		},
	});
}
