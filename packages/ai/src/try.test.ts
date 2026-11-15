import { CheckError, type Model, type Monti, type OpenKey } from "@monti-cms/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scriptedProvider } from "./fake";
import { levelFor, ProviderError } from "./provider";
import { modelTrial } from "./try";

const KEY: OpenKey = { id: "k", service: "openrouter", name: "OpenRouter", secret: "sk-or-…", baseUrl: null };

/** A site that only counts what the trial spent. */
function counting() {
	const spent: number[] = [];
	const site = {
		keys: { addUsage: async (_id: string, tokens: number) => void spent.push(tokens) },
	} as unknown as Monti;
	return { spent, site: () => site };
}

const reason = (error: unknown) => (error instanceof CheckError ? error.reason : error);

describe("the thinking level a model is asked for (AS-01)", () => {
	const must: Model = { id: "baidu/ernie", thinking: true, images: false, levels: ["high"] };

	it("a model that must think, and only hard, is asked to think hard where the job would have it stop", () => {
		expect(levelFor(must, "off")).toBe("high");
		expect(levelFor(must, "medium")).toBe("high");
	});

	it("the nearest level it takes, harder first; all of them when its service does not say; none for a model that cannot think", () => {
		const some: Model = { id: "m", thinking: true, images: false, levels: ["off", "low", "high"] };
		expect(levelFor(some, "medium")).toBe("high");
		expect(levelFor({ ...some, levels: ["off", "low"] }, "medium")).toBe("low");
		expect(levelFor({ thinking: true }, "off")).toBe("off");
		expect(levelFor({ thinking: false }, "high")).toBe("off");
		expect(levelFor(undefined, "high")).toBe("off");
	});
});

describe("a model tried before it is picked (doc 14, AS-01)", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("the quick tasks' model is asked for one answer in a fixed shape and one turn with a tool, with the least thinking it takes", async () => {
		const scripted = scriptedProvider([{ text: "OK" }], () => ({ value: "OK" }));
		const { spent, site } = counting();
		await modelTrial(
			site,
			scripted.for,
			60_000,
		)({
			for: "quick",
			key: KEY,
			model: { id: "baidu/ernie", thinking: true, images: false, levels: ["high"] },
		});
		expect(scripted.answers).toHaveLength(1);
		expect(scripted.answers[0]).toMatchObject({ model: "baidu/ernie", thinking: "high", thinks: true });
		// A request on picked words and "✦ Translate" are turns with tools on this model: a model that cannot take tools is not picked.
		expect(scripted.turns[0]).toMatchObject({ model: "baidu/ernie", thinking: "high" });
		expect(scripted.turns[0].tools).toHaveLength(1);
		expect(spent).toEqual([180]);
	});

	it("a conversation's model is asked for a turn with a tool offered", async () => {
		const scripted = scriptedProvider([{ text: "OK" }]);
		await modelTrial(
			counting().site,
			scripted.for,
			60_000,
		)({
			for: "assistant",
			key: KEY,
			model: { id: "anthropic/claude-sonnet-5.5", thinking: true, images: true },
		});
		expect(scripted.turns[0]).toMatchObject({ model: "anthropic/claude-sonnet-5.5", thinking: "low" });
		expect(scripted.turns[0].tools).toHaveLength(1);
	});

	it("a refusal is the job's own refusal, with the key's name and none of the service's words", async () => {
		const scripted = scriptedProvider([{ fail: new ProviderError("refused", "Reasoning is mandatory", 400) }]);
		const trial = modelTrial(
			counting().site,
			scripted.for,
			60_000,
		)({
			for: "assistant",
			key: KEY,
			model: { id: "m", thinking: false, images: false },
		});
		expect(await trial.then(() => "taken", reason)).toEqual({
			key: "assistant.failed",
			values: { reason: "refused", keyName: "OpenRouter" },
		});
	});

	it("a model that does not answer in time is too slow to pick", async () => {
		vi.useFakeTimers();
		const scripted = scriptedProvider([], () => new Promise(() => {}));
		const trial = modelTrial(
			counting().site,
			scripted.for,
			60_000,
		)({
			for: "quick",
			key: KEY,
			model: { id: "slow", thinking: false, images: false },
		}).then(() => "taken", reason);
		await vi.advanceTimersByTimeAsync(60_000);
		expect(await trial).toEqual({ key: "assistant.failed", values: { reason: "timeout", keyName: "OpenRouter" } });
	});
});
