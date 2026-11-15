import { describe, expect, it } from "vitest";
import { byName, dollarAmount, levelFor, modelTitle, priceWord, seconds } from "./models";

/** The words as the Korean dictionary has them, filled in. */
const WORDS: Record<string, string> = {
	"models.free": "무료",
	"models.price": "100만 토큰당 입력 {input}, 출력 {output}",
	"models.aliasOf": "지금: {model}",
	"models.context": "입력 한도 {amount} 토큰",
};
const t = (key: string, values: Record<string, string | number> = {}) =>
	(WORDS[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]));

describe("a model's price and tooltip (ST-31, ST-33)", () => {
	it("a price is a million tokens in and out, short; a free model says so; one whose service says nothing has none", () => {
		expect(priceWord(t, { price: { input: 1, output: 5 } })).toBe("$1 · $5");
		expect(priceWord(t, { price: { input: 0.25, output: 2.5 } })).toBe("$0.25 · $2.5");
		expect(priceWord(t, { price: { input: 0, output: 0 } })).toBe("무료");
		expect(priceWord(t, {})).toBeUndefined();
		expect([0.001, 2.3099999, 3.0000000004, 0].map(dollarAmount)).toEqual(["<$0.01", "$2.31", "$3", "$0"]);
	});

	it("the tooltip has the id, the price in words, what an alias stands for now and how much it takes in, a line each", () => {
		expect(
			modelTitle(t, {
				id: "~deepseek/deepseek-pro-latest",
				thinking: true,
				images: false,
				price: { input: 0.5, output: 2 },
				aliasOf: "DeepSeek: DeepSeek V4 Pro",
				context: 1_048_576,
			}),
		).toBe(
			"~deepseek/deepseek-pro-latest\n100만 토큰당 입력 $0.5, 출력 $2\n지금: DeepSeek: DeepSeek V4 Pro\n입력 한도 1.05M 토큰",
		);
		expect(modelTitle(t, { id: "claude-haiku-5-5", thinking: true, images: true })).toBe("claude-haiku-5-5");
	});

	it("a key's models are listed by name, so OpenRouter's stand together by provider", () => {
		const listed = byName([
			{ id: "z", label: "OpenAI: GPT-5.4 Mini", thinking: false, images: false },
			{ id: "a", label: "Meta: Llama 4", thinking: false, images: false },
			{ id: "anthropic/claude-haiku-5.5", label: "Anthropic: Claude Haiku 5.5", thinking: true, images: true },
			{ id: "llama4", thinking: false, images: false },
		]);
		expect(listed.map((model) => model.label ?? model.id)).toEqual([
			"Anthropic: Claude Haiku 5.5",
			"llama4",
			"Meta: Llama 4",
			"OpenAI: GPT-5.4 Mini",
		]);
	});
});

describe("the thinking level the panel shows (AS-01)", () => {
	it("the one wanted when the model takes it, else the nearest it takes, harder first; none for a model that cannot think", () => {
		const some = { thinking: true, levels: ["off", "low", "high"] as const };
		expect(levelFor({ ...some, levels: [...some.levels] }, "medium")).toBe("high");
		expect(levelFor({ thinking: true, levels: ["off", "low"] }, "medium")).toBe("low");
		expect(levelFor({ thinking: true, levels: ["high"] }, "off")).toBe("high");
		expect(levelFor({ thinking: true }, "low")).toBe("low");
		expect(levelFor({ thinking: false }, "high")).toBe("off");
	});
});

describe("how long a trial took", () => {
	it("one decimal under ten seconds, whole from there", () => {
		expect([1234, 980, 9960, 12_345, 3].map(seconds)).toEqual(["1.2", "1", "10", "12", "0"]);
	});
});
