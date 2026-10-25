import { APICallError, simulateReadableStream, streamText } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { isTransientModelError, withAgentRetry } from "../agent-model";
import { isToolsUnsupportedError } from "../provider";

const USAGE = {
	inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
	outputTokens: { total: 1, text: 1, reasoning: undefined },
};

const answer = (text: string): Outcome => ({
	stream: simulateReadableStream({
		chunks: [
			{ type: "text-start" as const, id: "t" },
			{ type: "text-delta" as const, id: "t", delta: text },
			{ type: "text-end" as const, id: "t" },
			{ type: "finish" as const, finishReason: { unified: "stop" as const, raw: undefined }, usage: USAGE },
		],
		chunkDelayInMs: null,
		initialDelayInMs: null,
	}),
});

type Outcome = Awaited<ReturnType<MockLanguageModelV4["doStream"]>>;

const providerError = (status: number, message: string) =>
	new APICallError({
		message,
		url: "https://example.test/v1/chat/completions",
		requestBodyValues: {},
		statusCode: status,
		responseBody: JSON.stringify({ error: { message } }),
	});

/** A model that plays one scripted outcome per request. */
function scripted(outcomes: Array<() => Promise<ReturnType<typeof answer>>>) {
	let index = 0;
	return new MockLanguageModelV4({
		doStream: async () => {
			const outcome = outcomes[index++];
			if (!outcome) throw new Error("more requests than scripted");
			return outcome();
		},
	});
}

const run = async (model: ReturnType<typeof scripted>, unsupported = () => {}) => {
	const errors: unknown[] = [];
	const result = streamText({
		model: withAgentRetry(model, { onToolsUnsupported: unsupported }),
		prompt: "hi",
		maxRetries: 0,
		onError: ({ error }) => {
			errors.push(error);
		},
	});
	const text = await result.text.then(
		(value) => value,
		() => null,
	);
	return { text, errors };
};

describe("the model of the agent", () => {
	it("asks again once when a request fails with a service problem", async () => {
		const model = scripted([
			async () => {
				throw providerError(502, "Provider returned error");
			},
			async () => answer("recovered"),
		]);
		const { text, errors } = await run(model);
		expect(text).toBe("recovered");
		expect(errors).toEqual([]);
		expect(model.doStreamCalls).toHaveLength(2);
	});

	it("asks again once when the service's first chunk is an error", async () => {
		const model = scripted([
			async () => ({
				stream: simulateReadableStream({
					chunks: [{ type: "error" as const, error: { message: "Provider returned error" } }],
					chunkDelayInMs: null,
					initialDelayInMs: null,
				}),
			}),
			async () => answer("second try"),
		]);
		expect((await run(model)).text).toBe("second try");
		expect(model.doStreamCalls).toHaveLength(2);
	});

	it("gives up after the one retry and ends with the provider's words", async () => {
		const model = scripted([
			async () => {
				throw providerError(503, "Upstream is down");
			},
			async () => {
				throw providerError(503, "Upstream is down");
			},
			async () => answer("never asked"),
		]);
		const { text, errors } = await run(model);
		expect(text).toBeNull();
		expect(model.doStreamCalls).toHaveLength(2);
		expect(String((errors[0] as Error).message)).toContain("Upstream is down");
	});

	it("does not ask again for a problem with the request, and reports a model that cannot call tools", async () => {
		let unsupported = 0;
		const model = scripted([
			async () => {
				throw providerError(404, "No endpoints found that support tool use");
			},
			async () => answer("never asked"),
		]);
		const { text } = await run(model, () => unsupported++);
		expect(text).toBeNull();
		expect(unsupported).toBe(1);
		expect(model.doStreamCalls).toHaveLength(1);
		const plain = scripted([
			async () => {
				throw providerError(400, "Bad request");
			},
			async () => answer("never asked"),
		]);
		await run(plain);
		expect(plain.doStreamCalls).toHaveLength(1);
	});
});

describe("telling failures apart", () => {
	it("knows the words services use for a model without tool calling", () => {
		for (const text of [
			"No endpoints found that support tool use",
			"This model does not support tools",
			"tools are not supported by this model",
			"Function calling is not supported for this model",
		]) {
			expect(isToolsUnsupportedError(providerError(404, text))).toBe(true);
		}
		for (const text of ["Rate limit reached", "Invalid API key", "Provider returned error"]) {
			expect(isToolsUnsupportedError(providerError(400, text))).toBe(false);
		}
	});

	it("treats service errors as transient and request errors as not", () => {
		expect(isTransientModelError(providerError(500, "boom"))).toBe(true);
		expect(isTransientModelError(providerError(401, "bad key"))).toBe(false);
		expect(isTransientModelError({ message: "Provider returned error" })).toBe(true);
		expect(isTransientModelError(new Error("something else"))).toBe(false);
	});
});
