import type { Cms } from "@monti-cms/core/server";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { admin, notesSite } from "../../../test/notes-site";
import { startAgentRun } from "../engine";

type StreamPart =
	Awaited<ReturnType<MockLanguageModelV4["doStream"]>>["stream"] extends ReadableStream<infer Part> ? Part : never;
const USAGE = {
	inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
	outputTokens: { total: 20, text: 20, reasoning: undefined },
};

/** A model that proposes a new text for note `a` on its first step and answers on the next. */
const proposingModel = () => {
	let step = 0;
	return new MockLanguageModelV4({
		provider: "test",
		modelId: "test",
		doStream: async () => {
			step += 1;
			const chunks: StreamPart[] =
				step === 1
					? [
							{
								type: "tool-call",
								toolCallId: "c1",
								toolName: "notes_set",
								input: JSON.stringify({ items: [{ id: "a", text: "ONE" }] }),
							},
							{ type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage: USAGE },
						]
					: [
							{ type: "text-start", id: "t" },
							{ type: "text-delta", id: "t", delta: "I proposed a new text for note a." },
							{ type: "text-end", id: "t" },
							{ type: "finish", finishReason: { unified: "stop", raw: undefined }, usage: USAGE },
						];
			return { stream: simulateReadableStream({ chunks, chunkDelayInMs: null, initialDelayInMs: null }) };
		},
	});
};

describe("agent engine", () => {
	it("AGENT-E1 runs a request whose write becomes a stored proposal sent to the panel, and stores the conversation with it", async () => {
		const site = notesSite({ a: "one" });
		const response = await startAgentRun({
			cms: site.cms as unknown as Cms,
			auth: admin,
			store: site.store,
			runtime: {
				model: proposingModel(),
				keyId: "k",
				modelName: "test",
				thinking: "off",
				tools: true,
				rememberTools: async () => undefined,
				recordUsage: async () => undefined,
			},
			body: {
				messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: "change note a" }] }],
				context: { screen: "entries" },
			},
		});
		const text = await response.text();
		const proposalParts = text
			.split("\n")
			.filter((line) => line.startsWith("data: {"))
			.map((line) => JSON.parse(line.slice(6)))
			.filter((chunk) => chunk.type === "data-proposal");
		expect(proposalParts).toHaveLength(1);
		expect(proposalParts[0].data).toMatchObject({ request: "change note a", status: "pending" });
		expect(proposalParts[0].data.items).toMatchObject([
			{ target: { id: "a" }, preview: { before: "one", after: "ONE" } },
		]);
		expect(site.notes.get("a")).toBe("one");

		const runId = proposalParts[0].data.runId as string;
		const run = await site.store.agentRuns.get(admin.userId, runId);
		expect(run?.status).toBe("done");
		expect(JSON.stringify(run?.messages)).toContain("data-proposal");
		expect(await site.store.proposals.ofRun(admin.userId, runId)).toHaveLength(1);
	});
});
