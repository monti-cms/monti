import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

type StreamPart =
	Awaited<ReturnType<MockLanguageModelV4["doStream"]>>["stream"] extends ReadableStream<infer Part> ? Part : never;

const USAGE = {
	inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
	outputTokens: { total: 20, text: 20, reasoning: undefined },
};

/** The `collections` of the `site_describe` result the model was given, if it has been given one. */
function collectionsSeen(prompt: ReadonlyArray<{ role: string; content: unknown }>): string[] | null {
	for (const message of prompt) {
		if (message.role !== "tool" || !Array.isArray(message.content)) continue;
		for (const part of message.content as Array<{ type?: string; toolName?: string; output?: { value?: unknown } }>) {
			if (part.type !== "tool-result" || part.toolName !== "site_describe") continue;
			const collections = (part.output?.value as { collections?: unknown } | undefined)?.collections;
			if (Array.isArray(collections)) return collections.map(String);
		}
	}
	return null;
}

/**
 * The agent's model with `CMS_AI_FAKE=1`: it needs no key and answers by script. First it calls `site_describe`; once it has the result it answers with the
 * names of the site's collections. The same input gives the same run, so tests and the browser check can rely on it.
 */
export function createFakeAgentModel() {
	return new MockLanguageModelV4({
		provider: "fake",
		modelId: "fake-agent",
		doStream: async ({ prompt }) => {
			const collections = collectionsSeen(prompt);
			const chunks: StreamPart[] =
				collections === null
					? [
							{ type: "tool-call", toolCallId: "fake-call-1", toolName: "site_describe", input: "{}" },
							{ type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage: USAGE },
						]
					: [
							{ type: "text-start", id: "fake-text" },
							{
								type: "text-delta",
								id: "fake-text",
								delta: `(fake) This site has these collections: ${collections.join(", ")}.`,
							},
							{ type: "text-end", id: "fake-text" },
							{ type: "finish", finishReason: { unified: "stop", raw: undefined }, usage: USAGE },
						];
			return { stream: simulateReadableStream({ chunks, chunkDelayInMs: null, initialDelayInMs: null }) };
		},
	});
}
