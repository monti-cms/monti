import { describe, expect, it } from "vitest";
import { z } from "zod";
import { type AiFakeHint, type AiRequest, createFakeGenerator } from "../provider";

const request = (result: AiRequest<unknown>["result"], fake: AiFakeHint): AiRequest<Record<string, unknown>> => ({
	system: "",
	content: [],
	schema: z.record(z.string(), z.unknown()),
	maxTokens: 100,
	result,
	fake,
});

const streamed = async (result: AiRequest<unknown>["result"], fake: AiFakeHint) => {
	let text = "";
	for await (const piece of createFakeGenerator().stream({ ...request(result, fake) })) text += piece;
	return text;
};

describe("fake generation model (development only)", () => {
	const fake = createFakeGenerator();

	it("answers by result shape and input kind (ignores input names)", async () => {
		const inputs = {
			heading: { kind: "text", value: "React Hooks" },
			source: { kind: "mdx", value: "안녕 **세계**" },
		} as const;
		expect(await fake.generate(request("mdx", { inputs }))).toEqual({ mdx: "안녕 **세계**" });
		expect(await fake.generate(request("text", { inputs }))).toEqual({ text: "(fake) React Hooks" });
		expect(await fake.generate(request("note", { inputs }))).toEqual({ note: "(fake) note" });
		expect(await fake.generate(request("candidates", { inputs: { heading: inputs.heading } }))).toEqual({
			candidates: ["react-hooks", "react-hooks-guide", "fake-react-hooks"],
		});
		// With a code input, a regex that matches in that code; with choices, a pick from the choices.
		expect(
			await fake.generate(request("candidates", { inputs: { snippet: { kind: "code", value: "const a = 1" } } })),
		).toEqual({ candidates: ["const", "\\d+"] });
		expect(await fake.generate(request("candidates", { inputs: {}, choices: ["c1", "c2"] }))).toEqual({
			candidates: ["c1", "c2"],
		});
	});

	it("streaming marks only MDX that starts with text, and leaves it as is when it starts with block syntax", async () => {
		expect(await streamed("mdx", { inputs: { piece: { kind: "mdx", value: "고칠 글" } } })).toBe("(fake) 고칠 글");
		const fence = "```js\nconst a = 1;\n```";
		expect(await streamed("mdx", { inputs: { piece: { kind: "mdx", value: fence } } })).toBe(fence);
		expect(await streamed("mdx", { inputs: { name: { kind: "text", value: "새 제목" } } })).toContain("## 새 제목");
	});

	it("uses the fake answer defined by the action if any (one candidate per line)", async () => {
		expect(await fake.generate(request("mdx", { inputs: {}, answer: () => "```chart\nx\n```" }))).toEqual({
			mdx: "```chart\nx\n```",
		});
		expect(await fake.generate(request("candidates", { inputs: {}, answer: () => "a\n\nb" }))).toEqual({
			candidates: ["a", "b"],
		});
	});
});
